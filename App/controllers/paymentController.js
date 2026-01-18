const axios = require("axios");
const Order = require("../models/order-model");

const getCleanUrl = (path, debugLocation) => {
  const rawEnv = process.env.FRONTEND_URL || "https://lilyandelarosekw.com";
  console.log(`🔍 [${debugLocation}] RAW ENV: "${rawEnv}" | LENGTH: ${rawEnv.length}`);
  
  const base = rawEnv.replace(/\/+$/, '');
  console.log(`🔍 [${debugLocation}] CLEAN BASE: "${base}"`);
  
  const fullUrl = `${base}${path.startsWith('/') ? path : '/' + path}`;
  console.log(`🔍 [${debugLocation}] FINAL URL: "${fullUrl}"`);
  
  return fullUrl;
};

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

    if (!process.env.MYFATOORAH_API_KEY) {
      return res.status(500).json({ isSuccess: false, message: "Payment gateway not configured" });
    }

    const paymentMethodId = paymentMethod === "knet" ? 1 : 2;
    console.log(`🎯 PaymentMethodId: ${paymentMethodId}`);

    // 🔥 DEBUG: URL GENERATION
    console.log("\n🔥🔥🔥 URL DEBUG START 🔥🔥🔥");
    const callbackUrl = getCleanUrl("/payment-success", "CREATE_PAYMENT_CALLBACK");
    const errorUrl = getCleanUrl("/payment-failed", "CREATE_PAYMENT_ERROR");
    console.log("🔥🔥🔥 URL DEBUG END 🔥🔥🔥\n");

    // 🔥 STEP 1: Call MyFatoorah FIRST (NO DB SAVE YET)
    const response = await axios.post(
      `${process.env.MYFATOORAH_BASE_URL || "https://api.myfatoorah.com"}/v2/ExecutePayment`,
      {
        PaymentMethodId: paymentMethodId,
        InvoiceValue: amount,
        CustomerName: customerName,
        CustomerEmail: customerEmail,
        CustomerMobile: phone,
        CallBackUrl: callbackUrl,
        ErrorUrl: errorUrl,
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
    console.log("📄 MyFatoorah CALLBACK URL:", response.data.Data?.CallBackUrl);
    console.log("📄 MyFatoorah ERROR URL:", response.data.Data?.ErrorUrl);

    // 🔥 STEP 2: ONLY SAVE TO DB IF MyFatoorah SUCCEEDS ✅
    if (!response.data.IsSuccess || !response.data.Data?.PaymentURL) {
      console.error("❌ MyFatoorah failed - NO DB SAVE:", response.data);
      return res.status(400).json({
        isSuccess: false,
        message: response.data.Message || "Payment execution failed",
      });
    }

    // ✅ MyFatoorah SUCCESS - NOW save order as "pending"
    const invoiceId = response.data.Data.InvoiceId;
    
    // 🔥 ENHANCED ORDER DATA with FULL ADDRESS VALIDATION
    console.log("🔍 SAVING ORDER DATA:", JSON.stringify(req.body.orderData, null, 2));
    
    await saveOrderToDB(req.body, invoiceId, "pending");

    console.log("🎉 PAYMENT URL:", response.data.Data.PaymentURL);
    
    res.json({
      isSuccess: true,
      paymentUrl: response.data.Data.PaymentURL,
      invoiceId: invoiceId,
    });

  } catch (error) {
    console.error("💥 PAYMENT ERROR - NO DB SAVE:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
    
    // 🔥 NO DB SAVE on ANY error
    res.status(500).json({
      isSuccess: false,
      message: error.response?.data?.Message || error.message || "Payment gateway error",
    });
  }
};

const saveOrderToDB = async (paymentData, invoiceId, status = "pending") => {
  try {
    const orderDataPayload = paymentData.orderData || {};
    
    console.log("🔍 RAW ORDER DATA:", JSON.stringify(orderDataPayload, null, 2));

    // 🔥 PERFECT PICKUP ORDER TRANSFORMATION
    const transformedOrder = {
      user: new mongoose.Types.ObjectId(paymentData.userId || "69667793740662c4efa2be87"),
      
      // ✅ Products from frontend items
      products: (orderDataPayload.products || orderDataPayload.items || []).map(item => ({
        product: new mongoose.Types.ObjectId(item.product || item._id || new Date().getTime()),
        quantity: parseInt(item.quantity) || 1,
        price: parseFloat(item.price) || 0,
        message: item.message || ""
      })),
      
      subtotal: parseFloat(orderDataPayload.subtotal) || parseFloat(paymentData.amount),
      shippingCost: parseFloat(orderDataPayload.shippingCost) || 0,
      totalAmount: parseFloat(paymentData.amount),
      promoCode: paymentData.promoCode || "",
      promoDiscount: parseFloat(paymentData.promoDiscount) || 0,
      orderType: orderDataPayload.orderType || "pickup",
      
      // 🔥 CRITICAL: scheduleTime conversion
      scheduleTime: {
        date: new Date(orderDataPayload.scheduleTime?.date), // String → Date
        timeSlot: orderDataPayload.scheduleTime?.timeSlot || ""
      },
      
      // 🔥 PICKUP ORDERS: shippingAddress = NULL (✅ SOLVES VALIDATION)
      // 🔥 DELIVERY ORDERS: Full address validation
      shippingAddress: orderDataPayload.orderType === "delivery" && orderDataPayload.shippingAddress
        ? {
            city: orderDataPayload.shippingAddress.city || "",
            area: orderDataPayload.shippingAddress.area || "",
            street: orderDataPayload.shippingAddress.street || "",
            block: parseInt(orderDataPayload.shippingAddress.block) || 0,
            house: parseInt(orderDataPayload.shippingAddress.house) || 0,
          }
        : null, // ← PICKUP = null (no validation errors!)
      
      userInfo: {
        name: paymentData.customerName || orderDataPayload.userInfo?.name || "Guest",
        phone: paymentData.phone || orderDataPayload.userInfo?.phone || "96500000000"
      },
      
      specialInstructions: orderDataPayload.specialInstructions || "",
      status: status,
      invoiceId: invoiceId,
      paymentStatus: status,
      paymentMethod: paymentData.paymentMethod,
      paymentGateway: "myfatoorah"
    };

    console.log("💾 TRANSFORMED ORDER:", {
      orderType: transformedOrder.orderType,
      shippingAddress: transformedOrder.shippingAddress ? "FULL ADDRESS" : "NULL (PICKUP)",
      productsCount: transformedOrder.products.length,
      totalAmount: transformedOrder.totalAmount
    });

    const newOrder = new Order(transformedOrder);
    const savedOrder = await newOrder.save();
    
    console.log(`✅ Order saved: ${savedOrder._id} | Type: ${transformedOrder.orderType}`);
    return savedOrder;

  } catch (error) {
    console.error("💥 DB SAVE ERROR:", error.message);
    throw new Error(`Order validation failed: ${error.message}`);
  }
};


const handlePaymentSuccess = async (req, res) => {
  console.log("\n🚨🚨🚨 SUCCESS CALLBACK HIT 🚨🚨🚨");
  console.log("📥 FULL QUERY:", JSON.stringify(req.query, null, 2));
  
  const { paymentId, invoiceId } = req.query;
  const id = paymentId || invoiceId;
  
  console.log("🎯 RAW ENV:", `"${process.env.FRONTEND_URL}"`);
  console.log("🎯 URL DEBUG START");
  const successUrl = getCleanUrl("/payment-success", "SUCCESS_HANDLER");
  const failedUrl = getCleanUrl("/payment-failed", "SUCCESS_HANDLER");
  console.log("🎯 URL DEBUG END");

  if (!id) {
    console.log("❌ No paymentId/invoiceId - redirecting to failed");
    console.log("🔗 REDIRECTING TO:", failedUrl);
    return res.redirect(failedUrl);
  }

  if (invoiceId) {
    try {
      const updatedOrder = await Order.findOneAndUpdate(
        { invoiceId },
        { 
          paymentStatus: "paid", 
          paymentId: paymentId || invoiceId,
          updatedAt: new Date()
        }
      );
      if (updatedOrder) {
        console.log(`✅ Success callback updated order ${updatedOrder._id} for invoice: ${invoiceId}`);
      } else {
        console.log(`⚠️ No order found for invoice: ${invoiceId}`);
      }
    } catch (error) {
      console.error("❌ Success callback update failed:", error);
    }
  }

  const finalRedirect = successUrl + `?paymentId=${id}`;
  console.log("🚀 FINAL REDIRECT:", finalRedirect);
  console.log("🚨🚨🚨 SUCCESS CALLBACK END 🚨🚨🚨\n");
  
  res.redirect(finalRedirect);
};

const handleWebhook = async (req, res) => {
  try {
    let webhookData;
    if (req.body && typeof req.body === 'string') {
      webhookData = JSON.parse(req.body);
    } else if (Buffer.isBuffer(req.body)) {
      webhookData = JSON.parse(req.body.toString());
    } else {
      webhookData = req.body;
    }

    console.log("🔔 WEBHOOK RECEIVED:", JSON.stringify(webhookData, null, 2));
    
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

    const order = await Order.findOne({ invoiceId: InvoiceId });
    if (!order) {
      console.log("❌ Order not found for InvoiceId:", InvoiceId);
      return res.status(404).json({ error: "Order not found" });
    }

    console.log(`🔄 Updating order ${order._id} | ${order.paymentStatus} → ${PaymentStatus}`);

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
  console.log("🔍 ENV FRONTEND_URL:", `"${process.env.FRONTEND_URL}"`);
  console.log("🔍 getCleanUrl TEST:", getCleanUrl("/test", "TEST_ENDPOINT"));
  res.json({
    isSuccess: true,
    message: "Controller working!",
    envUrl: process.env.FRONTEND_URL,
    cleanUrl: getCleanUrl("/test", "TEST"),
    received: req.body,
  });
};

const debugUrlsEndpoint = (req, res) => {
  console.log("🔍 DEBUG URLS HIT - ENV:", `"${process.env.FRONTEND_URL}"`);
  const testCallback = getCleanUrl("/payment-success", "DEBUG_ENDPOINT");
  const testError = getCleanUrl("/payment-failed", "DEBUG_ENDPOINT");
  
  res.json({
    envRaw: process.env.FRONTEND_URL,
    envLength: process.env.FRONTEND_URL?.length,
    hasTrailingSlash: process.env.FRONTEND_URL?.endsWith('/'),
    callbackUrl: testCallback,
    errorUrl: testError,
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  createMyFatoorahPayment,
  handlePaymentSuccess,
  handleWebhook,
  testPaymentEndpoint,
  saveOrderToDB,
  debugUrlsEndpoint
};
