const axios = require("axios");
const Order = require("../models/order-model");

// 🔥 FIXED: Enhanced cleanUrl function
const cleanUrl = (baseUrl, path) => {
  if (!baseUrl || !path) return path;
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const cleanPath = path.replace(/^\/+/, '');
  return `${cleanBase}/${cleanPath}`;
};

// 🔥 FIXED: Enhanced UserDefinedField parsing
const parseUserDefinedField = (userDefinedField) => {
  if (!userDefinedField) return null;

  try {
    // Handle JSON string or object
    const parsed = typeof userDefinedField === "string"
      ? JSON.parse(userDefinedField)
      : userDefinedField;

    // Extract orderId from multiple possible locations
    return {
      orderId: parsed.orderId || parsed.OrderId || parsed.order_data?.orderId,
      userId: parsed.userId,
      paymentMethod: parsed.paymentMethod
    };
  } catch (e) {
    console.warn("⚠️ UserDefinedField parse failed:", userDefinedField);
    return null;
  }
};

const mapPaymentMethod = (paymentMethod) => {
  if (!paymentMethod) return "other";
  const methodLower = paymentMethod.toLowerCase();
  if (methodLower.includes("knet")) return "knet";
  if (methodLower.includes("visa") || methodLower.includes("master") ||
    methodLower.includes("card") || methodLower.includes("credit") ||
    methodLower.includes("debit")) return "card";
  return "other";
};

const createMyFatoorahPayment = async (req, res) => {
  try {
    console.log("🚀 === PAYMENT CONTROLLER REACHED ===");
    console.log("📥 FULL REQUEST:", JSON.stringify(req.body, null, 2));

    const paymentMethod = req.body.paymentMethod || req.body.payment_method || "card";
    const amountRaw = req.body.amount;
    const customerName = req.body.customerName || req.body.customer_name || "Guest Customer";
    const customerEmail = req.body.customerEmail || "customer@lilian.com";
    const phone = req.body.phone || req.body.customerPhone || "96500000000";
    const userId = req.body.userId || "guest";
    const orderId = req.body.orderId || null;

    console.log(`🎯 Processing: ${amountRaw} KWD | ${paymentMethod} | ${userId} | OrderId: ${orderId}`);

    // VALIDATION
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

    console.log(`🔗 Clean URLs - Success: ${successUrl}, Error: ${errorUrl}`);

    // 🔥 MyFatoorah Execute Payment
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
          orderId,           // ✅ Primary order ID
          order_data: req.body.orderData || req.body,  // Fallback
          paymentMethod,
          timestamp: Date.now()
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
      console.error("❌ MyFatoorah failed:", response.data);
      return res.status(400).json({
        isSuccess: false,
        message: response.data.Message || "Payment execution failed",
      });
    }

    const invoiceId = response.data.Data?.InvoiceId;

    // 🔥 Save invoiceId to order IMMEDIATELY
    if (orderId && invoiceId) {
      try {
        const updatedOrder = await Order.findByIdAndUpdate(
          orderId,
          {
            invoiceId: invoiceId.toString(),
            paymentMethod: paymentMethod,
            paymentUrl: response.data.Data.PaymentURL,
          },
          { new: true }
        );
        console.log(`✅ Order ${orderId} SAVED with InvoiceId: ${invoiceId}`);
        console.log("Updated order:", updatedOrder);
      } catch (error) {
        console.error(`💥 FAILED to save order ${orderId}:`, error.message);
      }
    } else {
      console.warn("⚠️ No orderId or invoiceId to save");
    }

    console.log("🎉 PAYMENT URL:", response.data.Data.PaymentURL);
    res.json({
      isSuccess: true,
      paymentUrl: response.data.Data.PaymentURL,
      invoiceId: invoiceId ? invoiceId.toString() : null,
      orderId: orderId,  // ✅ Return orderId to frontend
    });
  } catch (error) {
    console.error("💥 PAYMENT ERROR:", error.message);
    res.status(500).json({
      isSuccess: false,
      message: error.response?.data?.Message || error.message || "Payment gateway error",
    });
  }
};

// 🔥 FIXED: Enhanced handlePaymentSuccess
const handlePaymentSuccess = async (req, res) => {
  console.log("📥 SUCCESS CALLBACK:", req.query);
  const { paymentId, invoiceId, orderId } = req.query;

  const frontendUrl = process.env.FRONTEND_URL || "https://lilyandelarosekw.com";

  if (!paymentId && !invoiceId) {
    console.log("❌ No payment ID - redirecting to error");
    return res.redirect(cleanUrl(frontendUrl, "payment-failed"));
  }

  // 🔥 Include orderId in success URL if available
  const successParams = new URLSearchParams();
  if (paymentId) successParams.append('paymentId', paymentId);
  if (invoiceId) successParams.append('invoiceId', invoiceId);
  if (orderId) successParams.append('orderId', orderId);

  const cleanSuccessUrl = cleanUrl(frontendUrl, `payment-success?${successParams.toString()}`);
  console.log("✅ Success redirect:", cleanSuccessUrl);
  res.redirect(cleanSuccessUrl);
};

// 🔥 FIXED: COMPLETE Webhook - Multiple Order ID Sources
const handleWebhook = async (req, res) => {
  try {
    console.log("=".repeat(80));
    console.log("🔔 WEBHOOK V1 RECEIVED AT:", new Date().toISOString());

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
      console.error("❌ Failed to parse webhook body:", parseError);
      return res.status(200).json({ success: false, error: "Invalid JSON format" });
    }

    console.log("📦 WEBHOOK PAYLOAD:", JSON.stringify(webhookData, null, 2));

    const paymentData = webhookData.Data || webhookData.data || webhookData;
    const invoiceId = paymentData.InvoiceId || paymentData.invoiceId;
    const paymentId = paymentData.PaymentId || paymentData.paymentId;
    const transactionStatus = paymentData.TransactionStatus || paymentData.transactionStatus;
    const paymentMethod = paymentData.PaymentMethod || paymentData.paymentMethod;

    console.log(`📋 WEBHOOK DATA: InvoiceId=${invoiceId}, PaymentId=${paymentId}, Status=${transactionStatus}`);

    // 🔥 FIXED: Enhanced UserDefinedField parsing
    let userDefinedData = parseUserDefinedField(paymentData.UserDefinedField);
    const orderIdFromField = userDefinedData?.orderId;

    console.log(`🔍 Order search: invoiceId=${invoiceId}, orderId=${orderIdFromField}`);

    const isPaid = transactionStatus === "SUCCESS" || transactionStatus === "Success";

    if (!invoiceId) {
      console.warn("⚠️ No InvoiceId in webhook");
      return res.status(200).json({ success: true, message: "No InvoiceId" });
    }

    // 🔥 STEP 1: Search by invoiceId (primary)
    let order = await Order.findOne({
      $or: [
        { invoiceId: invoiceId.toString() },
        { invoiceId: invoiceId },
        { invoiceId: parseInt(invoiceId) }
      ]
    });

    // 🔥 STEP 2: Search by paymentId
    if (!order && paymentId) {
      order = await Order.findOne({
        $or: [
          { paymentId: paymentId.toString() },
          { paymentId: paymentId }
        ]
      });
    }

    // 🔥 STEP 3: Search by orderId from UserDefinedField
    if (!order && orderIdFromField) {
      try {
        order = await Order.findById(orderIdFromField);
      } catch (e) {
        console.warn(`⚠️ Invalid ObjectId: ${orderIdFromField}`);
      }
    }

    // 🔥 STEP 4: Log search results
    if (order) {
      console.log(`✅ FOUND ORDER: ${order._id} | InvoiceId: ${order.invoiceId} | Status: ${order.status}`);
    } else {
      console.log(`❌ NO ORDER FOUND for InvoiceId: ${invoiceId}, PaymentId: ${paymentId}, OrderIdField: ${orderIdFromField}`);

      // 🔥 DEBUG: List recent orders
      const recentOrders = await Order.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('_id invoiceId paymentId status createdAt');
      console.log("Recent orders:", JSON.stringify(recentOrders, null, 2));
    }

    // 🔥 Update order if found
    if (order) {
      const updateData = {
        isPaid,
        invoiceId: invoiceId.toString(),
        paymentId: paymentId?.toString(),
        paymentMethod: mapPaymentMethod(paymentMethod),
      };

      if (isPaid) {
        updateData.paidAt = new Date();
        updateData.status = "paid";
      } else {
        updateData.status = "failed";
      }

      const updatedOrder = await Order.findByIdAndUpdate(order._id, updateData, { new: true });
      console.log(`✅ ORDER UPDATED: ${order._id} → isPaid: ${isPaid}, status: ${updatedOrder.status}`);
    }

    console.log("=".repeat(80));
    res.status(200).json({
      success: true,
      processed: !!order,
      invoiceId: invoiceId?.toString(),
      paymentId: paymentId?.toString(),
      orderId: order?._id?.toString(),
      status: transactionStatus
    });

  } catch (error) {
    console.error("💥 WEBHOOK ERROR:", error.message, error.stack);
    res.status(200).json({ success: false, error: error.message });
  }
};

module.exports = {
  createMyFatoorahPayment,
  handlePaymentSuccess,
  handleWebhook,

};
