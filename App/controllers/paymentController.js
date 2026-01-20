const axios = require("axios");
const Order = require("../models/order-model");

// Mapper function to convert MyFatoorah PaymentMethod to enum values
const mapPaymentMethod = (paymentMethod) => {
  if (!paymentMethod) return "other";
  
  const methodLower = paymentMethod.toLowerCase();
  
  // Map KNET variations
  if (methodLower.includes("knet")) {
    return "knet";
  }
  
  // Map card variations (VISA/MASTER, VISA, MASTER, CARD, etc.)
  if (methodLower.includes("visa") || 
      methodLower.includes("master") || 
      methodLower.includes("card") ||
      methodLower.includes("credit") ||
      methodLower.includes("debit")) {
    return "card";
  }
  
  // Default to other for unknown payment methods
  return "other";
};

const createMyFatoorahPayment = async (req, res) => {
  try {
    console.log("🚀 === PAYMENT CONTROLLER REACHED ===");
    console.log("📥 FULL REQUEST:", JSON.stringify(req.body, null, 2));

    // ✅ NO USER MODEL - PURE PAYMENT LOGIC
    const paymentMethod =
      req.body.paymentMethod || req.body.payment_method || "card";
    const amountRaw = req.body.amount;
    const customerName =
      req.body.customerName || req.body.customer_name || "Guest Customer";
    const customerEmail = req.body.customerEmail || "customer@lilian.com";
    const phone = req.body.phone || req.body.customerPhone || "96500000000";
    const userId = req.body.userId || "guest";
    const orderId = req.body.orderId || null;

    console.log(
      `🎯 Processing: ${amountRaw} KWD | ${paymentMethod} | ${userId}`
    );

    // VALIDATION
    if (!amountRaw) {
      return res
        .status(400)
        .json({ isSuccess: false, message: "Amount is required" });
    }

    const amount = parseFloat(amountRaw);
    if (isNaN(amount) || amount < 0.1) {
      return res
        .status(400)
        .json({ isSuccess: false, message: "Minimum amount is 0.100 KWD" });
    }

    // API KEY CHECK
    if (!process.env.MYFATOORAH_API_KEY) {
      return res
        .status(500)
        .json({ isSuccess: false, message: "Payment gateway not configured" });
    }

    // PAYMENT METHOD ID
    const paymentMethodId = paymentMethod === "knet" ? 1 : 2;
    console.log(`🎯 PaymentMethodId: ${paymentMethodId}`);

    // 🔥 MYFATOORAH DIRECT EXECUTE PAYMENT
    const response = await axios.post(
      `${
        process.env.MYFATOORAH_BASE_URL || "https://api.myfatoorah.com"
      }/v2/ExecutePayment`,
      {
        PaymentMethodId: paymentMethodId,
        InvoiceValue: amount,
        CustomerName: customerName,
        CustomerEmail: customerEmail,
        CustomerMobile: phone,
        CallBackUrl: `${
          process.env.FRONTEND_URL || "https://lilyandelarosekw.com"
        }/payment-success`,
        ErrorUrl: `${
          process.env.FRONTEND_URL || "https://lilyandelarosekw.com"
        }/payment-failed`,
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

    console.log(
      "✅ MyFatoorah Response:",
      response.data.IsSuccess,
      !!response.data.Data?.PaymentURL
    );

    if (!response.data.IsSuccess || !response.data.Data?.PaymentURL) {
      console.error("❌ MyFatoorah failed:", response.data);
      return res.status(400).json({
        isSuccess: false,
        message: response.data.Message || "Payment execution failed",
      });
    }

    // Extract invoice ID from response
    const invoiceId = response.data.Data?.InvoiceId;

    // Save invoiceId to order if orderId is provided
    if (orderId && invoiceId) {
      try {
        await Order.findByIdAndUpdate(orderId, {
          invoiceId: invoiceId.toString(),
          paymentMethod: paymentMethod,
        });
        console.log(`✅ Order ${orderId} updated with InvoiceId: ${invoiceId}`);
      } catch (error) {
        console.error(`⚠️ Failed to update order ${orderId}:`, error.message);
        // Don't fail the payment creation if order update fails
      }
    }

    console.log("🎉 PAYMENT URL:", response.data.Data.PaymentURL);
    res.json({
      isSuccess: true,
      paymentUrl: response.data.Data.PaymentURL,
      invoiceId: invoiceId ? invoiceId.toString() : null,
    });
  } catch (error) {
    console.error("💥 PAYMENT ERROR:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });

    res.status(500).json({
      isSuccess: false,
      message:
        error.response?.data?.Message ||
        error.message ||
        "Payment gateway error",
    });
  }
};

const handlePaymentSuccess = async (req, res) => {
  console.log("📥 SUCCESS CALLBACK:", req.query);
  const { paymentId, invoiceId } = req.query;
  const id = paymentId || invoiceId;

  if (!id) {
    return res.redirect(
      `${
        process.env.FRONTEND_URL || "https://lilyandelarosekw.com"
      }/payment-failed`
    );
  }
  res.redirect(
    `${
      process.env.FRONTEND_URL || "https://lilyandelarosekw.com"
    }/payment-success?paymentId=${id}`
  );
};

const handleWebhook = async (req, res) => {
  try {
    console.log("=".repeat(60));
    console.log("🔔 WEBHOOK V1 RECEIVED AT:", new Date().toISOString());
    
    // MyFatoorah V1 sends webhook as raw JSON string or Buffer
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
      return res.status(200).json({ 
        success: false, 
        error: "Invalid JSON format"
      });
    }

    console.log("📦 Full Webhook Payload:", JSON.stringify(webhookData, null, 2));

    // MyFatoorah V1 Webhook Structure: The payload is the Data object
    // Extract data - webhook payload is the Data object directly
    const paymentData = webhookData.Data || webhookData.data || webhookData;
    
    // Extract invoice and payment information from V1 format
    const invoiceId = paymentData.InvoiceId || paymentData.invoiceId;
    const paymentId = paymentData.PaymentId || paymentData.paymentId;
    // V1 uses TransactionStatus (NOT InvoiceStatus) - values: "SUCCESS", "FAILED", "PENDING"
    const transactionStatus = paymentData.TransactionStatus || paymentData.transactionStatus;
    // V1 uses PaymentMethod (NOT PaymentGateway) - values: "VISA/MASTER", "KNET", etc.
    const paymentMethod = paymentData.PaymentMethod || paymentData.paymentMethod;
    // Extract orderId from UserDefinedField if available
    let userDefinedField = paymentData.UserDefinedField || paymentData.userDefinedField;
    let orderIdFromField = null;
    
    if (userDefinedField) {
      try {
        // UserDefinedField might be a JSON string or already an object
        const parsedField = typeof userDefinedField === "string" 
          ? JSON.parse(userDefinedField) 
          : userDefinedField;
        orderIdFromField = parsedField.orderId || parsedField.OrderId;
      } catch (e) {
        // If parsing fails, UserDefinedField might just be a string
        console.warn("⚠️ Could not parse UserDefinedField as JSON:", e.message);
        console.warn("⚠️ UserDefinedField value:", userDefinedField);
      }
    }

    console.log(
      `📋 V1 Webhook: InvoiceId=${invoiceId}, PaymentId=${paymentId}, TransactionStatus=${transactionStatus}, PaymentMethod=${paymentMethod}, OrderIdFromField=${orderIdFromField}`
    );

    // V1 TransactionStatus values: "SUCCESS", "FAILED", "PENDING", etc.
    const isPaid = transactionStatus === "SUCCESS" || transactionStatus === "Success";

    if (!invoiceId) {
      console.warn("⚠️ Webhook missing InvoiceId - Full payload:", webhookData);
      return res.status(200).json({ 
        success: true, 
        message: "No InvoiceId provided",
        received: webhookData
      });
    }

    // Convert invoiceId to string for consistent searching
    const invoiceIdStr = invoiceId.toString();

    // Try to find order by invoiceId (handle both string and number formats)
    let order = await Order.findOne({
      $or: [
        { invoiceId: invoiceIdStr },
        { invoiceId: invoiceId },
        { invoiceId: parseInt(invoiceId) }
      ]
    });

    // If not found, try to find by paymentId
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

    // If still not found, try using orderId from UserDefinedField
    if (!order && orderIdFromField) {
      try {
        order = await Order.findById(orderIdFromField);
        if (order) {
          console.log(`✅ Found order using UserDefinedField orderId: ${orderIdFromField}`);
        }
      } catch (e) {
        console.warn(`⚠️ Invalid orderId from UserDefinedField: ${orderIdFromField}`);
      }
    }

    if (!order) {
      console.warn(`⚠️ Order not found for InvoiceId: ${invoiceId}, OrderIdFromField: ${orderIdFromField || "not found"}`);
    }

    // Update order payment status if found
    if (order) {
      const updateData = {
        isPaid,
        invoiceId: invoiceIdStr,
        paymentId: paymentId ? paymentId.toString() : order.paymentId,
      };

      if (isPaid) {
        updateData.paidAt = new Date();
        updateData.status = "paid"; // Update order status to paid
        // Map payment method from MyFatoorah to enum values
        if (paymentMethod) {
          updateData.paymentMethod = mapPaymentMethod(paymentMethod);
        }
      }

      await Order.findByIdAndUpdate(order._id, updateData);

      console.log(
        `✅ Order ${order._id} payment status updated: isPaid=${isPaid}, TransactionStatus=${transactionStatus}, PaymentMethod=${paymentMethod}`
      );
    } else {
      console.warn(
        `⚠️ Could not update order - InvoiceId ${invoiceId} not found in database`
      );
    }

    console.log("=".repeat(60));

    // Always return 200 to acknowledge webhook receipt (required by MyFatoorah)
    res.status(200).json({ 
      success: true, 
      processed: !!order,
      invoiceId: invoiceIdStr,
      transactionStatus,
      orderId: order?._id?.toString() || null
    });
  } catch (error) {
    console.error("💥 WEBHOOK ERROR:", error.message);
    console.error("💥 Stack:", error.stack);
    console.log("=".repeat(60));
    
    // Still return 200 to prevent MyFatoorah from retrying
    res.status(200).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

const testPaymentEndpoint = (req, res) => {
  console.log("✅ TEST ENDPOINT REACHED - NO AUTH!");
  console.log("📥 PAYLOAD:", req.body);
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
