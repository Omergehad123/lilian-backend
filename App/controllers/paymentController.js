const axios = require("axios");
const Order = require("../models/order-model");

const createMyFatoorahPayment = async (req, res) => {
  try {
    console.log("🚀 === PAYMENT CONTROLLER REACHED ===");
    console.log("📥 FULL REQUEST:", JSON.stringify(req.body, null, 2));

    // Extract payment data
    const paymentMethod = req.body.paymentMethod || req.body.payment_method || "card";
    const amountRaw = req.body.amount;
    const customerName = req.body.customerName || req.body.customer_name || "Guest Customer";
    const customerEmail = req.body.customerEmail || "customer@lilian.com";
    const phone = req.body.phone || req.body.customerPhone || "96500000000";
    const userId = req.body.userId || "guest";

    console.log(`🎯 Processing: ${amountRaw} KWD | ${paymentMethod} | ${userId}`);

    // VALIDATION
    if (!amountRaw) {
      return res.status(400).json({ isSuccess: false, message: "Amount is required" });
    }

    const amount = parseFloat(amountRaw);
    if (isNaN(amount) || amount < 0.1) {
      return res.status(400).json({ isSuccess: false, message: "Minimum amount is 0.100 KWD" });
    }

    // API KEY CHECK
    if (!process.env.MYFATOORAH_API_KEY) {
      return res.status(500).json({ isSuccess: false, message: "Payment gateway not configured" });
    }

    // PAYMENT METHOD ID
    const paymentMethodId = paymentMethod === "knet" ? 1 : 2;
    console.log(`🎯 PaymentMethodId: ${paymentMethodId}`);

    // 🔥 MYFATOORAH DIRECT EXECUTE PAYMENT
    const response = await axios.post(
      `${process.env.MYFATOORAH_BASE_URL || "https://api.myfatoorah.com"}/v2/ExecutePayment`,
      {
        PaymentMethodId: paymentMethodId,
        InvoiceValue: amount,
        CustomerName: customerName,
        CustomerEmail: customerEmail,
        CustomerMobile: phone,
        CallBackUrl: `${process.env.FRONTEND_URL || "https://lilyandelarosekw.com"}/payment-success`,
        ErrorUrl: `${process.env.FRONTEND_URL || "https://lilyandelarosekw.com"}/payment-failed`,
        NotificationOption: "ALL",
        Lang: "en",
        DisplayCurrencyIso: "KWD",
        UserDefinedField: JSON.stringify({
          userId,
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

    console.log("✅ MyFatoorah Response:", response.data.IsSuccess, !!response.data.Data?.PaymentURL);

    if (!response.data.IsSuccess || !response.data.Data?.PaymentURL) {
      // ✅ Save FAILED order
      await saveOrderToDB(req.body, response.data.Data?.InvoiceId || null, "failed");
      console.error("❌ MyFatoorah failed:", response.data);
      return res.status(400).json({
        isSuccess: false,
        message: response.data.Message || "Payment execution failed",
      });
    }

    // ✅ Save PENDING order BEFORE redirecting to payment
    const invoiceId = response.data.Data.InvoiceId;
    await saveOrderToDB(req.body, invoiceId, "pending");

    console.log("🎉 PAYMENT URL:", response.data.Data.PaymentURL);
    res.json({
      isSuccess: true,
      paymentUrl: response.data.Data.PaymentURL,
      invoiceId: invoiceId, // ✅ Return invoiceId for frontend tracking
    });
  } catch (error) {
    console.error("💥 PAYMENT ERROR:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });

    res.status(500).json({
      isSuccess: false,
      message: error.response?.data?.Message || error.message || "Payment gateway error",
    });
  }
};

// ✅ NEW: Save order to database
const saveOrderToDB = async (paymentData, invoiceId, status = "pending") => {
  try {
    const orderData = {
      ...paymentData.orderData,
      userId: paymentData.userId,
      customerName: paymentData.customerName,
      customerEmail: paymentData.customerEmail,
      customerPhone: paymentData.phone,
      invoiceId: invoiceId, // MyFatoorah Invoice ID
      paymentStatus: status, // pending | paid | failed
      paymentMethod: paymentData.paymentMethod,
      subtotal: parseFloat(paymentData.amount),
      promoCode: paymentData.promoCode || "",
      promoDiscount: parseFloat(paymentData.promoDiscount || 0),
      totalAmount: parseFloat(paymentData.amount),
      paymentGateway: "myfatoorah",
      items: paymentData.orderData?.items || [],
      shippingAddress: paymentData.orderData?.shippingAddress || null,
      orderType: paymentData.orderData?.orderType || "pickup",
      scheduledSlot: paymentData.orderData?.scheduledSlot || null,
      specialInstructions: paymentData.orderData?.specialInstructions || "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const newOrder = new Order(orderData);
    const savedOrder = await newOrder.save();
    
    console.log(`✅ Order saved: ${savedOrder._id} | Status: ${status} | Invoice: ${invoiceId}`);
    return savedOrder;
  } catch (error) {
    console.error("❌ Order save failed:", error);
    throw error;
  }
};

// ✅ UPDATED: Handle payment success callback
const handlePaymentSuccess = async (req, res) => {
  console.log("📥 SUCCESS CALLBACK:", req.query);
  const { paymentId, invoiceId } = req.query;
  const id = paymentId || invoiceId;

  if (!id) {
    return res.redirect(`${process.env.FRONTEND_URL || "https://lilyandelarosekw.com"}/payment-failed`);
  }

  // ✅ Update order to PAID status
  if (invoiceId) {
    try {
      await Order.findOneAndUpdate(
        { invoiceId },
        { 
          paymentStatus: "paid", 
          paymentId: paymentId || invoiceId,
          updatedAt: new Date()
        }
      );
      console.log(`✅ Success callback updated order for invoice: ${invoiceId}`);
    } catch (error) {
      console.error("❌ Success callback update failed:", error);
    }
  }

  res.redirect(
    `${process.env.FRONTEND_URL || "https://lilyandelarosekw.com"}/payment-success?paymentId=${id}`
  );
};

// ✅ FIXED: Complete Webhook Handler (MOST IMPORTANT!)
// ✅ REPLACE your handleWebhook function with this COMPLETE version:
const handleWebhook = async (req, res) => {
  try {
    // ✅ Parse raw JSON body
    let webhookData;
    if (req.body && typeof req.body === 'string') {
      webhookData = JSON.parse(req.body);
    } else if (Buffer.isBuffer(req.body)) {
      webhookData = JSON.parse(req.body.toString());
    } else {
      webhookData = req.body;
    }

    console.log("🔔 WEBHOOK RECEIVED:", JSON.stringify(webhookData, null, 2));
    
    // ✅ Verify webhook signature
    const signature = req.headers['mfh-pay-key'];
    console.log("🔑 Webhook signature:", signature ? "PRESENT" : "MISSING");
    
    if (signature !== process.env.MYFATOORAH_WEBHOOK_SECRET) {
      console.log("❌ Webhook signature mismatch");
      return res.status(401).json({ error: "Invalid signature" });
    }

    const { InvoiceId, PaymentId, PaymentStatus } = webhookData;
    
    if (!InvoiceId) {
      console.log("❌ Missing InvoiceId in webhook");
      return res.status(400).json({ error: "Missing InvoiceId" });
    }

    // ✅ Find order
    const order = await Order.findOne({ invoiceId: InvoiceId });
    if (!order) {
      console.log("❌ Order not found for InvoiceId:", InvoiceId);
      return res.status(404).json({ error: "Order not found" });
    }

    console.log(`🔄 Updating order ${order._id} | ${order.paymentStatus} → ${PaymentStatus}`);

    // ✅ Handle ALL possible statuses
    switch (PaymentStatus) {
      case "PAID":
        order.paymentStatus = "paid";
        order.paymentId = PaymentId;
        order.updatedAt = new Date();
        await order.save();
        console.log(`✅ Order ${order._id} marked as PAID ✅`);
        break;
      
      case "CANCELLED":
      case "FAILED":
      case "CANCELED":
        order.paymentStatus = "failed";
        order.updatedAt = new Date();
        await order.save();
        console.log(`❌ Order ${order._id} marked as ${PaymentStatus}`);
        break;
      
      default:
        console.log(`ℹ️ Unknown status ${PaymentStatus} for order ${order._id}`);
    }

    res.status(200).json({ 
      success: true, 
      message: "Webhook processed successfully",
      orderId: order._id 
    });
  } catch (error) {
    console.error("💥 WEBHOOK ERROR:", error);
    res.status(500).json({ error: "Webhook processing failed" });
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
  saveOrderToDB,
};
