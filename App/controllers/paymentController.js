const axios = require("axios");
const mongoose = require("mongoose");
const Order = require("../models/order-model");

const createMyFatoorahPayment = async (req, res) => {
  try {
    console.log("🚀 === PAYMENT CONTROLLER REACHED ===");
    console.log("📥 FULL REQUEST:", JSON.stringify(req.body, null, 2));

    // Extract basic data
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

    // ✅ FIXED: Clean URL construction
    const baseUrl = process.env.FRONTEND_URL || "https://lilyandelarosekw.com";
    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const successUrl = `${cleanBaseUrl}/payment-success`;
    const errorUrl = `${cleanBaseUrl}/payment-failed`;

    console.log(`🎯 Clean URLs: Success=${successUrl}, Error=${errorUrl}`);

    // PAYMENT METHOD ID
    const paymentMethodId = paymentMethod === "knet" ? 1 : 2;
    console.log(`🎯 PaymentMethodId: ${paymentMethodId}`);

    // ✅ EXTRACT FULL ORDER DATA for webhook
    const orderData = {
      products: req.body.products || [],
      orderType: req.body.orderType || "pickup",
      scheduleTime: req.body.scheduleTime || { 
        date: new Date(Date.now() + 24*60*60*1000), 
        timeSlot: "02:00 PM - 06:00 PM" 
      },
      shippingAddress: req.body.shippingAddress || {},
      userInfo: {
        name: customerName,
        phone: phone
      },
      subtotal: req.body.subtotal || amount,
      totalAmount: amount,
      promoCode: req.body.promoCode || "",
      promoDiscount: req.body.promoDiscount || 0,
      shippingCost: req.body.shippingCost || 0,
      specialInstructions: req.body.specialInstructions || ""
    };

    // 🔥 MYFATOORAH EXECUTE PAYMENT with CLEAN URLs
    const response = await axios.post(
      `${process.env.MYFATOORAH_BASE_URL || "https://api.myfatoorah.com"}/v2/ExecutePayment`,
      {
        PaymentMethodId: paymentMethodId,
        InvoiceValue: amount,
        CustomerName: customerName,
        CustomerEmail: customerEmail,
        CustomerMobile: phone,
        CallBackUrl: successUrl,        // ✅ CLEAN URL
        ErrorUrl: errorUrl,            // ✅ CLEAN URL
        NotificationOption: "ALL",
        Lang: "en",
        DisplayCurrencyIso: "KWD",
        UserDefinedField: JSON.stringify({
          userId,
          orderData,
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
      console.error("❌ MyFatoorah failed:", response.data);
      return res.status(400).json({
        isSuccess: false,
        message: response.data.Message || "Payment execution failed",
      });
    }

    console.log("🎉 PAYMENT URL:", response.data.Data.PaymentURL);
    res.json({
      isSuccess: true,
      paymentUrl: response.data.Data.PaymentURL,
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

const handlePaymentSuccess = async (req, res) => {
  console.log("📥 SUCCESS CALLBACK:", req.query);
  const { paymentId, invoiceId } = req.query;
  const id = paymentId || invoiceId;

  if (!id) {
    // ✅ FIXED: Clean redirect URL
    const baseUrl = process.env.FRONTEND_URL || "https://lilyandelarosekw.com";
    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    return res.redirect(`${cleanBaseUrl}/payment-failed`);
  }
  
  // ✅ FIXED: Clean success redirect with paymentId
  const baseUrl = process.env.FRONTEND_URL || "https://lilyandelarosekw.com";
  const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  res.redirect(`${cleanBaseUrl}/payment-success?paymentId=${id}`);
};

const handleWebhook = async (req, res) => {
  console.log("🔔 WEBHOOK RECEIVED:", req.body);
  
  try {
    const { InvoiceId, PaymentId, PaymentStatus, CustomerRefNo } = req.body;

    if (PaymentStatus !== 'PAID') {
      console.log("❌ Webhook: Payment not PAID, ignoring");
      return res.status(200).json({ success: true });
    }

    // Parse UserDefinedField data
    const refData = JSON.parse(CustomerRefNo || '{}');
    const { userId, orderData } = refData;

    if (!userId || !orderData) {
      console.log("❌ Missing userId or orderData in webhook");
      return res.status(400).json({ success: false, message: "Invalid webhook data" });
    }

    // 🔥 FIXED: Add paymentId/invoiceId to existingOrder check
    const existingOrder = await Order.findOne({ 
      $or: [{ paymentId: PaymentId }, { invoiceId: InvoiceId }] 
    });
    
    if (existingOrder) {
      console.log("✅ Order already exists:", existingOrder._id);
      return res.status(200).json({ success: true });
    }

    // ✅ SAFE ObjectId conversion with error handling
    let userObjectId;
    try {
      userObjectId = new mongoose.Types.ObjectId(userId);
    } catch (error) {
      console.log("❌ Invalid userId format:", userId);
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    // CREATE ORDER
    const newOrder = new Order({
      user: userObjectId,
      products: orderData.products || [],
      totalAmount: orderData.totalAmount,
      orderType: orderData.orderType,
      scheduleTime: orderData.scheduleTime,
      shippingAddress: orderData.shippingAddress,
      userInfo: orderData.userInfo,
      status: "confirmed",
      promoCode: orderData.promoCode || "",
      promoDiscount: orderData.promoDiscount || 0,
      subtotal: orderData.subtotal || orderData.totalAmount,
      shippingCost: orderData.shippingCost || 0,
      specialInstructions: orderData.specialInstructions || "",
      // 🔥 ADD PAYMENT TRACKING FIELDS
      paymentId: PaymentId,
      invoiceId: InvoiceId
    });

    await newOrder.save();
    console.log("✅ ORDER SAVED TO DB:", newOrder._id);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("💥 WEBHOOK ERROR:", error);
    res.status(500).json({ success: false, error: error.message });
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
