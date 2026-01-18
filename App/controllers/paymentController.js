const axios = require("axios");
// ❌ REMOVE: const User = require("../models/users.model");

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
      }/payment-f backwards`
    );
  }
  res.redirect(
    `${
      process.env.FRONTEND_URL || "https://lilyandelarosekw.com"
    }/payment-success?paymentId=${id}`
  );
};

const handleWebhook = async (req, res) => {
  console.log("🔔 WEBHOOK RECEIVED:", req.body);
  res.status(200).json({ success: true });
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
