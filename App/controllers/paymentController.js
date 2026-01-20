const axios = require("axios");
const Order = require("../models/order-model");

// 🔥 Clean URL helper
const cleanUrl = (baseUrl, path) => {
  if (!baseUrl || !path) return path;
  const cleanBase = baseUrl.replace(/\/+$/, "");
  const cleanPath = path.replace(/^\/+/, "");
  return `${cleanBase}/${cleanPath}`;
};

// 🔥 Payment method mapper
const mapPaymentMethod = (paymentMethod) => {
  if (!paymentMethod) return "other";
  const m = paymentMethod.toLowerCase();

  if (m.includes("knet")) return "knet";
  if (
    m.includes("visa") ||
    m.includes("master") ||
    m.includes("card") ||
    m.includes("credit") ||
    m.includes("debit")
  ) {
    return "card";
  }
  return "other";
};

// ===============================
// CREATE PAYMENT (ORDER REQUIRED)
// ===============================
const createMyFatoorahPayment = async (req, res) => {
  try {
    console.log("🚀 PAYMENT INIT");

    const {
      amount,
      paymentMethod = "card",
      customerName = "Guest Customer",
      customerEmail = "customer@lilian.com",
      phone = "96500000000",
      userId = "guest",
      orderId,
    } = req.body;

    // 🚨 HARD RULE: ORDER MUST EXIST
    if (!orderId) {
      return res.status(400).json({
        isSuccess: false,
        message: "Order must be created before payment",
      });
    }

    // Validate order existence
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        isSuccess: false,
        message: "Order not found",
      });
    }

    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue < 0.1) {
      return res.status(400).json({
        isSuccess: false,
        message: "Invalid payment amount",
      });
    }

    if (!process.env.MYFATOORAH_API_KEY) {
      return res.status(500).json({
        isSuccess: false,
        message: "Payment gateway not configured",
      });
    }

    const paymentMethodId = paymentMethod === "knet" ? 1 : 2;

    const frontendUrl =
      process.env.FRONTEND_URL || "https://lilyandelarosekw.com";

    const successUrl = cleanUrl(frontendUrl, `payment-success?orderId=${orderId}`);
    const errorUrl = cleanUrl(frontendUrl, `payment-failed?orderId=${orderId}`);

    // ===============================
    // EXECUTE PAYMENT
    // ===============================
    const response = await axios.post(
      `${process.env.MYFATOORAH_BASE_URL}/v2/ExecutePayment`,
      {
        PaymentMethodId: paymentMethodId,
        InvoiceValue: amountValue,
        CustomerName: customerName,
        CustomerEmail: customerEmail,
        CustomerMobile: phone,
        CallBackUrl: successUrl,
        ErrorUrl: errorUrl,
        NotificationOption: "ALL",
        Lang: "en",
        DisplayCurrencyIso: "KWD",

        // 🔥 ONLY IDENTIFIERS — NO ORDER DATA
        UserDefinedField: JSON.stringify({
          orderId,
          userId,
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

    if (!response.data?.IsSuccess || !response.data?.Data?.PaymentURL) {
      return res.status(400).json({
        isSuccess: false,
        message: response.data?.Message || "Payment initiation failed",
      });
    }

    const invoiceId = response.data.Data.InvoiceId?.toString();

    // 🔥 Save invoiceId BEFORE redirect
    await Order.findByIdAndUpdate(orderId, {
      invoiceId,
      paymentMethod,
    });

    console.log(`✅ Payment initiated for Order ${orderId}`);

    res.json({
      isSuccess: true,
      paymentUrl: response.data.Data.PaymentURL,
      invoiceId,
    });
  } catch (error) {
    console.error("💥 PAYMENT ERROR:", error.message);
    res.status(500).json({
      isSuccess: false,
      message:
        error.response?.data?.Message ||
        error.message ||
        "Payment gateway error",
    });
  }
};

// ===============================
// SUCCESS REDIRECT (UI ONLY)
// ===============================
const handlePaymentSuccess = (req, res) => {
  const { orderId } = req.query;

  const frontendUrl =
    process.env.FRONTEND_URL || "https://lilyandelarosekw.com";

  if (!orderId) {
    return res.redirect(cleanUrl(frontendUrl, "payment-failed"));
  }

  res.redirect(
    cleanUrl(frontendUrl, `payment-success?orderId=${orderId}`)
  );
};

// ===============================
// WEBHOOK (SOURCE OF TRUTH)
// ===============================
const handleWebhook = async (req, res) => {
  try {
    let payload =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : Buffer.isBuffer(req.body)
          ? JSON.parse(req.body.toString())
          : req.body;

    const data = payload.Data || payload;

    const invoiceId = data.InvoiceId?.toString();
    const paymentId = data.PaymentId?.toString();
    const status = data.TransactionStatus;
    const paymentMethod = data.PaymentMethod;

    let orderId = null;

    if (data.UserDefinedField) {
      try {
        const parsed =
          typeof data.UserDefinedField === "string"
            ? JSON.parse(data.UserDefinedField)
            : data.UserDefinedField;
        orderId = parsed.orderId;
      } catch { }
    }

    if (!invoiceId && !orderId) {
      return res.status(200).json({ success: true });
    }

    let order = null;

    if (orderId) {
      order = await Order.findById(orderId);
    }

    if (!order && invoiceId) {
      order = await Order.findOne({ invoiceId });
    }

    if (!order) {
      console.warn("⚠️ Webhook order not found");
      return res.status(200).json({ success: true });
    }

    const isPaid =
      status === "SUCCESS" || status === "Success";

    // If already paid, skip
    if (order.isPaid && isPaid) {
      return res.status(200).json({ success: true });
    }

    const update = {
      invoiceId,
      paymentId,
    };

    if (isPaid) {
      update.isPaid = true;
      update.status = "paid";
      update.paidAt = new Date();
      if (paymentMethod) {
        update.paymentMethod = mapPaymentMethod(paymentMethod);
      }
    }

    await Order.findByIdAndUpdate(order._id, update);

    console.log(`✅ Order ${order._id} updated via webhook`);

    res.status(200).json({
      success: true,
      orderId: order._id,
      isPaid,
    });
  } catch (err) {
    console.error("💥 WEBHOOK ERROR:", err.message);
    res.status(200).json({ success: false });
  }
};

const testPaymentEndpoint = (req, res) => {
  res.json({ isSuccess: true, message: "Payment controller OK" });
};

module.exports = {
  createMyFatoorahPayment,
  handlePaymentSuccess,
  handleWebhook,
  testPaymentEndpoint,
};
