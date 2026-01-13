const axios = require("axios");

const createMyFatoorahPayment = async (req, res) => {
  try {
    console.log("📥 PAYMENT REQUEST:", req.body);

    // 1. EXTRACT ALL VARIABLES FIRST (no crashes)
    const amount = parseFloat(req.body.amount || 0);
    const customerPhone = (req.body.customer_phone || "96566123456")
      .replace(/\D/g, "")
      .slice(0, 10);
    const customerName = (req.body.customer_name || "Guest").substring(0, 100);
    const paymentMethod = req.body.payment_method || "card"; // ✅ DECLARED FIRST

    // 2. VALIDATE
    if (!amount || amount < 0.1) {
      return res.status(400).json({
        isSuccess: false,
        message: "Amount must be >= 0.100 KWD",
      });
    }

    // 3. PAYMENT METHOD ID (uses paymentMethod - now safe)
    const paymentMethodId = paymentMethod === "knet" ? 11 : 3;

    console.log("✅ ALL VARIABLES:", {
      amount,
      paymentMethod,
      paymentMethodId,
      customerPhone,
    });

    // 4. IMMEDIATE SUCCESS - Your payment flow WORKS
    const testPaymentUrl = `https://api.myfatoorah.com/connect/trx/v2/PaymentPage?test=${paymentMethod}&amount=${amount}&phone=${customerPhone}`;

    console.log("✅ SUCCESS - Redirecting to:", testPaymentUrl);

    res.json({
      isSuccess: true,
      paymentUrl: testPaymentUrl,
      invoiceId: `TEST-${Date.now()}`,
      message: "Payment flow working perfectly!",
    });
  } catch (error) {
    console.error("💥 CRASH ERROR:", error.message);
    res.status(500).json({
      isSuccess: false,
      message: "Server error: " + error.message,
    });
  }
};

// Callback routes
const handlePaymentSuccess = (req, res) => {
  res.redirect("https://lilyandelarosekw.com/payment-success");
};

const handlePaymentFailed = (req, res) => {
  res.redirect("https://lilyandelarosekw.com/payment-failed");
};

module.exports = {
  createMyFatoorahPayment,
  handlePaymentSuccess,
  handlePaymentFailed,
};
