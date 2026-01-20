const axios = require("axios");
const Order = require("../models/order-model");

// Clean URL function
const cleanUrl = (baseUrl, path) => {
  if (!baseUrl || !path) return path;

  const cleanBase = baseUrl.replace(/\/+$/, '');
  const cleanPath = path.replace(/^\/+/, '');

  return `${cleanBase}/${cleanPath}`;
};

const mapPaymentMethod = (paymentMethod) => {
  if (!paymentMethod) return "other";

  const methodLower = paymentMethod.toLowerCase();

  if (methodLower.includes("knet")) return "knet";

  if (
    methodLower.includes("visa") ||
    methodLower.includes("master") ||
    methodLower.includes("card") ||
    methodLower.includes("credit") ||
    methodLower.includes("debit")
  ) return "card";

  return "other";
};

const createMyFatoorahPayment = async (req, res) => {
  try {
    const paymentMethod = req.body.paymentMethod || req.body.payment_method || "card";
    const amountRaw = req.body.amount;
    const customerName = req.body.customerName || req.body.customer_name || "Guest Customer";
    const customerEmail = req.body.customerEmail || "customer@lilian.com";
    const phone = req.body.phone || req.body.customerPhone || "96500000000";
    const userId = req.body.userId || "guest";
    const orderId = req.body.orderId || null;

    if (!amountRaw) {
      return res.status(400).json({ isSuccess: false, message: "Amount is required" });
    }

    const amount = parseFloat(amountRaw);
    if (isNaN(amount) || amount < 0.1) {
      return res.status(400).json({ isSuccess: false, message: "Minimum amount is 0.100 KWD" });
    }

    if (!process.env.MYFATOORAH_API_KEY) {
      return res.status(500).json({ isSuccess: false, message: "Payment gateway not configured" });
    }

    const paymentMethodId = paymentMethod === "knet" ? 1 : 2;

    const frontendUrl = process.env.FRONTEND_URL || "https://lilyandelarosekw.com";
    const successUrl = cleanUrl(frontendUrl, "payment-success");
    const errorUrl = cleanUrl(frontendUrl, "payment-failed");

    const response = await axios.post(
      `${process.env.MYFATOORAH_BASE_URL || "https://api.myfatoorah.com"}/v2/ExecutePayment`,
      {
        PaymentMethodId: paymentMethodId,
        InvoiceValue: amount,
        CustomerName: customerName,
        CustomerEmail: customerEmail,
        CustomerMobile: phone,
        CallBackUrl: successUrl,
        ErrorUrl: errorUrl,
        NotificationOption: "ALL",
        Lang: "en",
        DisplayCurrencyIso: "KWD",
        UserDefinedField: JSON.stringify({
          userId,
          orderId,
          orderData: req.body.orderData || req.body,
          paymentMethod,
        }),
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.MYFATOORAH_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    if (!response.data.IsSuccess || !response.data.Data?.PaymentURL) {
      return res.status(400).json({
        isSuccess: false,
        message: response.data.Message || "Payment execution failed",
      });
    }

    const invoiceId = response.data.Data?.InvoiceId;

    if (orderId && invoiceId) {
      try {
        await Order.findByIdAndUpdate(orderId, {
          invoiceId: invoiceId.toString(),
          paymentMethod: paymentMethod,
        });
      } catch (error) {
        console.error(`⚠️ Failed to update order ${orderId}:`, error.message);
      }
    }

    res.json({
      isSuccess: true,
      paymentUrl: response.data.Data.PaymentURL,
      invoiceId: invoiceId ? invoiceId.toString() : null,
    });
  } catch (error) {
    res.status(500).json({
      isSuccess: false,
      message: error.response?.data?.Message || error.message || "Payment gateway error",
    });
  }
};

const handlePaymentSuccess = async (req, res) => {
  const { paymentId, invoiceId } = req.query;
  const id = paymentId || invoiceId;

  const frontendUrl = process.env.FRONTEND_URL || "https://lilyandelarosekw.com";

  if (!id) {
    const cleanErrorUrl = cleanUrl(frontendUrl, "payment-failed");
    return res.redirect(cleanErrorUrl);
  }

  const cleanSuccessUrl = cleanUrl(frontendUrl, `payment-success?paymentId=${id}`);
  res.redirect(cleanSuccessUrl);
};

const handleWebhook = async (req, res) => {
  try {
    let webhookData;
    try {
      if (Buffer.isBuffer(req.body)) {
        webhookData = JSON.parse(req.body.toString());
      } else if (typeof req.body === "string") {
        webhookData = JSON.parse(req.body);
      } else {
        webhookData = req.body;
      }
    } catch (parseError) {
      return res.status(200).json({ success: false, error: "Invalid JSON format" });
    }

    const paymentData = webhookData.Data || webhookData.data || webhookData;

    const invoiceId = paymentData.InvoiceId || paymentData.invoiceId;
    const paymentId = paymentData.PaymentId || paymentData.paymentId;
    const transactionStatus = paymentData.TransactionStatus || paymentData.transactionStatus;
    const paymentMethod = paymentData.PaymentMethod || paymentData.paymentMethod;

    let userDefinedField = paymentData.UserDefinedField || paymentData.userDefinedField;
    let orderIdFromField = null;

    if (userDefinedField) {
      try {
        const parsedField = typeof userDefinedField === "string"
          ? JSON.parse(userDefinedField)
          : userDefinedField;
        orderIdFromField = parsedField.orderId || parsedField.OrderId;
      } catch (e) {
        console.warn("⚠️ Could not parse UserDefinedField as JSON:", e.message);
      }
    }

    const isPaid = transactionStatus === "SUCCESS" || transactionStatus === "Success";

    if (!invoiceId) {
      return res.status(200).json({ success: true, message: "No InvoiceId provided" });
    }

    const invoiceIdStr = invoiceId.toString();

    let order = await Order.findOne({
      $or: [
        { invoiceId: invoiceIdStr },
        { invoiceId: invoiceId },
        { invoiceId: parseInt(invoiceId) }
      ]
    });

    if (!order && paymentId) {
      const paymentIdStr = paymentId.toString();
      order = await Order.findOne({
        $or: [
          { paymentId: paymentIdStr },
          { paymentId: paymentId },
          { paymentId: parseInt(paymentId) }
        ]
      });
    }

    if (!order && orderIdFromField) {
      try {
        order = await Order.findById(orderIdFromField);
      } catch (e) {
        console.warn(`⚠️ Invalid orderId from UserDefinedField: ${orderIdFromField}`);
      }
    }

    if (order) {
      const updateData = {
        isPaid,
        invoiceId: invoiceIdStr,
        paymentId: paymentId ? paymentId.toString() : order.paymentId,
      };

      if (isPaid) {
        updateData.paidAt = new Date();
        updateData.status = "paid";
        if (paymentMethod) updateData.paymentMethod = mapPaymentMethod(paymentMethod);
      }

      await Order.findByIdAndUpdate(order._id, updateData);
    }

    res.status(200).json({
      success: true,
      processed: !!order,
      invoiceId: invoiceIdStr,
      transactionStatus,
      orderId: order?._id?.toString() || null
    });
  } catch (error) {
    res.status(200).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

const testPaymentEndpoint = (req, res) => {
  res.json({
    isSuccess: true,
    message: "Controller working!",
    received: req.body,
  });
};

module.exports = {
  createMyFatoorahPayment,
  handlePaymentSuccess,
  handleWebhook,
  testPaymentEndpoint,
};
