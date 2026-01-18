const express = require("express");
const router = express.Router();
const {
  createMyFatoorahPayment,
  handlePaymentSuccess,
  handleWebhook,
  testPaymentEndpoint,
} = require("../App/controllers/paymentController");

console.log("✅ Payment routes loaded");

// ✅ NO AUTH REQUIRED for payment - GUESTS CAN PAY
router.post("/myfatoorah", createMyFatoorahPayment);
router.get("/success", handlePaymentSuccess); 

// 🔥 CRITICAL: Raw body parser for MyFatoorah webhook signature verification
router.post("/webhook", express.raw({ type: 'application/json' }), handleWebhook);

router.post("/test", testPaymentEndpoint);

module.exports = router;
