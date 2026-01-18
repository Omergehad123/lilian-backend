const crypto = require("crypto");
const axios = require("axios");
const mongoose = require("mongoose");
const Order = require("../models/order-model");

// 🔥 BULLETPROOF URL CLEANER
const cleanUrl = (baseUrl, path) => {
  const cleanBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const cleanPath = path.replace(/^\/+/, "/");
  return `${cleanBase}${cleanPath}`;
};

const createMyFatoorahPayment = async (req, res) => {
  try {
    console.log("🚀 === PAYMENT CONTROLLER REACHED ===");
    console.log("📥 FULL REQUEST:", JSON.stringify(req.body, null, 2));

    const paymentMethod = req.body.paymentMethod || "card";
    const amountRaw = req.body.amount;
    const customerName = req.body.customerName || "Guest Customer";
    const customerEmail = req.body.customerEmail || "customer@lilian.com";
    const phone = req.body.phone || "96500000000";
    const userId = req.body.userId || "guest";

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

    const baseUrl = process.env.FRONTEND_URL || "https://lilyandelarosekw.com";
    const successUrl = cleanUrl(baseUrl, "/payment-success");
    const errorUrl = cleanUrl(baseUrl, "/payment-failed");

    const paymentMethodId = paymentMethod === "knet" ? 1 : 2;

    // FULL ORDER DATA (TEMP – used by webhook)
    const orderData = {
      products: req.body.products || [],
      orderType: req.body.orderType || "pickup",
      scheduleTime: req.body.scheduleTime || {
        date: new Date(Date.now() + 24 * 60 * 60 * 1000),
        timeSlot: "02:00 PM - 06:00 PM",
      },
      shippingAddress: req.body.shippingAddress || {},
      userInfo: { name: customerName, phone },
      subtotal: req.body.subtotal || amount,
      totalAmount: amount,
      promoCode: req.body.promoCode || "",
      promoDiscount: req.body.promoDiscount || 0,
      shippingCost: req.body.shippingCost || 0,
      specialInstructions: req.body.specialInstructions || "",
    };

    const response = await axios.post(
      `${process.env.MYFATOORAH_BASE_URL}/v2/ExecutePayment`,
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

        // ✅ CORRECT FIELD
        CustomerReference: JSON.stringify({
          userId,
          orderData,
        }),
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.MYFATOORAH_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.data.IsSuccess || !response.data.Data?.PaymentURL) {
      return res.status(400).json({
        isSuccess: false,
        message: response.data.Message || "Payment execution failed",
      });
    }

    res.json({
      isSuccess: true,
      paymentUrl: response.data.Data.PaymentURL,
    });
  } catch (error) {
    console.error("💥 PAYMENT ERROR:", error.response?.data || error.message);
    res.status(500).json({
      isSuccess: false,
      message: "Payment gateway error",
    });
  }
};

const handlePaymentSuccess = (req, res) => {
  const { paymentId, invoiceId } = req.query;
  const id = paymentId || invoiceId;

  const baseUrl = process.env.FRONTEND_URL || "https://lilyandelarosekw.com";

  if (!id) {
    return res.redirect(cleanUrl(baseUrl, "/payment-failed"));
  }

  res.redirect(`${cleanUrl(baseUrl, "/payment-success")}?paymentId=${id}`);
};

const handleWebhook = async (req, res) => {
  const rawBody = req.body.toString();  // <- raw string
  const payload = JSON.parse(rawBody);  // <- parsed object

  const signature = req.get("MyFatoorah-Signature");
  const secret = process.env.MYFATOORAH_WEBHOOK_SECRET;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("base64");

  if (signature !== expected) {
    return res.status(401).json({ success: false });
  }

  // now you can use payload
  if (payload.PaymentStatus === "PAID") {
    await processOrderFromWebhook(payload);
  }

  res.status(200).json({ success: true });
};

const processOrderFromWebhook = async (webhookData) => {
  try {
    const { CustomerReference } = webhookData;
    const { userId, orderData } = JSON.parse(CustomerReference || "{}");

    if (!orderData) {
      console.error("❌ ORDER DATA MISSING");
      return;
    }

    const duplicate = await Order.findOne({
      "userInfo.phone": orderData.userInfo?.phone,
      totalAmount: orderData.totalAmount,
    });

    if (duplicate) {
      console.log("🟡 DUPLICATE ORDER SKIPPED");
      return;
    }

    const userObjectId =
      userId && mongoose.Types.ObjectId.isValid(userId)
        ? new mongoose.Types.ObjectId(userId)
        : new mongoose.Types.ObjectId();

    const order = new Order({
      user: userObjectId,
      products: orderData.products,
      totalAmount: orderData.totalAmount,
      orderType: orderData.orderType,
      shippingAddress: {
        city: orderData.shippingAddress?.city || "Kuwait City",
        address: orderData.shippingAddress?.address || "N/A",
        ...orderData.shippingAddress,
      },
      scheduleTime: orderData.scheduleTime,
      userInfo: orderData.userInfo,
      status: "confirmed",
      promoCode: orderData.promoCode,
      promoDiscount: orderData.promoDiscount,
      subtotal: orderData.subtotal,
      shippingCost: orderData.shippingCost,
      specialInstructions: orderData.specialInstructions,
    });

    await order.save();
    console.log("🎉 ORDER SAVED:", order._id);
  } catch (err) {
    console.error("💥 ORDER SAVE ERROR:", err.message);
  }
};

module.exports = {
  createMyFatoorahPayment,
  handlePaymentSuccess,
  handleWebhook,
};
