const crypto = require('crypto'); // ✅ ADD THIS
const axios = require("axios");
const mongoose = require("mongoose");
const Order = require("../models/order-model");

// 🔥 BULLETPROOF URL CLEANER
const cleanUrl = (baseUrl, path) => {
  let cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  let cleanPath = path.replace(/^\/+/, '/');
  return `${cleanBase}${cleanPath}`;
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

    console.log(`🎯 Processing: ${amountRaw} KWD | ${paymentMethod} | ${userId}`);

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

    // 🔥 BULLETPROOF URL CLEANING
    const baseUrl = process.env.FRONTEND_URL || "https://lilyandelarosekw.com";
    const successUrl = cleanUrl(baseUrl, "/payment-success");
    const errorUrl = cleanUrl(baseUrl, "/payment-failed");

    console.log(`🎯 CLEAN URLs: Success=${successUrl} | Error=${errorUrl}`);

    const paymentMethodId = paymentMethod === "knet" ? 1 : 2;

    // FULL ORDER DATA
    const orderData = {
      products: req.body.products || [],
      orderType: req.body.orderType || "pickup",
      scheduleTime: req.body.scheduleTime || { 
        date: new Date(Date.now() + 24*60*60*1000), 
        timeSlot: "02:00 PM - 06:00 PM" 
      },
      shippingAddress: req.body.shippingAddress || {},
      userInfo: { name: customerName, phone: phone },
      subtotal: req.body.subtotal || amount,
      totalAmount: amount,
      promoCode: req.body.promoCode || "",
      promoDiscount: req.body.promoDiscount || 0,
      shippingCost: req.body.shippingCost || 0,
      specialInstructions: req.body.specialInstructions || ""
    };

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
        UserDefinedField: JSON.stringify({ userId, orderData, paymentMethod }),
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

  const baseUrl = process.env.FRONTEND_URL || "https://lilyandelarosekw.com";
  
  if (!id) {
    const cleanRedirect = cleanUrl(baseUrl, "/payment-failed");
    console.log("🔗 REDIRECTING TO FAILED:", cleanRedirect);
    return res.redirect(cleanRedirect);
  }
  
  const successRedirect = `${cleanUrl(baseUrl, "/payment-success")}?paymentId=${id}`;
  console.log("🔗 REDIRECTING TO SUCCESS:", successRedirect);
  res.redirect(successRedirect);
};

const handleWebhook = async (req, res) => {
  console.log("🔔 WEBHOOK HIT! Status:", req.body.PaymentStatus);
  console.log("🔔 FULL PAYLOAD:", JSON.stringify(req.body, null, 2));
  
  // VALIDATE SIGNATURE
  const signature = req.get('MyFatoorah-Signature');
  const webhookSecret = process.env.MYFATOORAH_WEBHOOK_SECRET;
  
  if (signature && webhookSecret) {
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(req.body), 'utf8')
      .digest('base64');
    
    if (signature !== expectedSignature) {
      console.error("❌ SIGNATURE FAILED");
      return res.status(401).json({ success: false });
    }
    console.log("✅ SIGNATURE VALID ✓");
  }

  res.status(200).json({ success: true });
  
  if (req.body.PaymentStatus === 'PAID') {
    processOrderFromWebhook(req.body).catch(console.error);
  }
};

const processOrderFromWebhook = async (webhookData) => {
  try {
    console.log("🔄 PROCESSING ORDER...");
    
    const { CustomerRefNo } = webhookData;
    const refData = JSON.parse(CustomerRefNo || '{}');
    const { userId, orderData } = refData;

    console.log("📦 Parsed data:", { userId, hasOrderData: !!orderData });

    if (!orderData) {
      console.error("❌ NO ORDER DATA");
      return;
    }

    // DUPLICATE CHECK
    const existingOrder = await Order.findOne({
      $and: [
        { "userInfo.phone": orderData.userInfo?.phone },
        { totalAmount: orderData.totalAmount }
      ]
    });

    if (existingOrder) {
      console.log("✅ DUPLICATE SKIPPED:", existingOrder._id);
      return;
    }

    // 🔥 FIX: Always provide valid user ObjectId (guest or real user)
    let userObjectId;
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      userObjectId = new mongoose.Types.ObjectId(userId);
    } else {
      // Create dummy ObjectId for guest orders
      userObjectId = new mongoose.Types.ObjectId();
    }

    const newOrder = new Order({
      user: userObjectId,  // ✅ ALWAYS REQUIRED - schema satisfied
      
      products: orderData.products || [],
      totalAmount: parseFloat(orderData.totalAmount) || 0,
      orderType: orderData.orderType || "pickup",
      
      // Complete shippingAddress
      shippingAddress: {
        city: orderData.shippingAddress?.city || "Kuwait City",
        address: orderData.shippingAddress?.address || "N/A",
        ...orderData.shippingAddress
      },
      
      scheduleTime: orderData.scheduleTime || {
        date: new Date(Date.now() + 24*60*60*1000),
        timeSlot: "02:00 PM - 06:00 PM"
      },
      
      userInfo: {
        name: orderData.userInfo?.name || "Guest Customer",
        phone: orderData.userInfo?.phone || "96500000000"
      },
      
      status: "confirmed",
      promoCode: orderData.promoCode || "",
      promoDiscount: parseFloat(orderData.promoDiscount) || 0,
      subtotal: parseFloat(orderData.subtotal) || parseFloat(orderData.totalAmount) || 0,
      shippingCost: parseFloat(orderData.shippingCost) || 0,
      specialInstructions: orderData.specialInstructions || ""
    });

    const savedOrder = await newOrder.save();
    console.log("🎉 ORDER SAVED SUCCESSFULLY! ID:", savedOrder._id);
    
  } catch (error) {
    console.error("💥 SAVE ERROR:", error.message);
  }
};


const testPaymentEndpoint = (req, res) => {
  console.log("✅ TEST ENDPOINT:", req.body);
  res.json({ isSuccess: true, message: "Working!", received: req.body });
};

module.exports = {
  createMyFatoorahPayment,
  handlePaymentSuccess,
  handleWebhook,
  testPaymentEndpoint,
};
