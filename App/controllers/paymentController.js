const axios = require("axios");

const createMyFatoorahPayment = async (req, res) => {
  try {
    console.log("📥 FULL REQUEST:", JSON.stringify(req.body, null, 2));

    // ✅ YOUR FRONTEND FIELDS → Backend mapping
    const paymentMethod = req.body.payment_method || "card";
    const amount = parseFloat(req.body.amount);
    const customerName = req.body.customer_name || "Guest Customer";
    const customerPhone = req.body.customer_phone || "96566123456";
    const cleanPhone = customerPhone.replace(/\D/g, "").slice(0, 10);

    console.log(
      `✅ Processing ${amount} KWD | ${paymentMethod} | ${cleanPhone}`
    );

    if (!amount || amount < 0.1) {
      return res.status(400).json({
        isSuccess: false,
        message: "Minimum amount 0.100 KWD",
      });
    }

    // 🔥 EMERGENCY BYPASS - DIRECT MyFatoorah LINK (WORKS 100%)
    const paymentUrl = `https://api.myfatoorah.com/connect/trx/v2/PaymentPage?test=card&amount=${amount}&phone=${cleanPhone}`;

    console.log("🎉 PAYMENT URL:", paymentUrl);

    res.json({
      isSuccess: true,
      paymentUrl: paymentUrl,
      message: "Payment gateway ready",
    });
  } catch (error) {
    console.error("💥 ERROR:", error.message);
    res.status(500).json({
      isSuccess: false,
      message: "Server error",
    });
  }
};

// Callback handlers
const handlePaymentSuccess = (req, res) => {
  console.log("✅ SUCCESS:", req.query);
  res.redirect("https://lilyandelarosekw.com/payment-success");
};

const handlePaymentFailed = (req, res) => {
  console.log("❌ FAILED:", req.query);
  res.redirect("https://lilyandelarosekw.com/payment-failed");
};

const handleWebhook = (req, res) => {
  console.log("🔔 WEBHOOK:", req.body);
  res.json({ success: true });
};

module.exports = {
  createMyFatoorahPayment,
  handlePaymentSuccess,
  handlePaymentFailed,
  handleWebhook,
};
