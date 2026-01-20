const express = require("express");
const router = express.Router();
const {
  createMyFatoorahPayment,
  handlePaymentSuccess,
  handleWebhook,

} = require("../App/controllers/paymentController");

console.log("✅ Payment routes loaded");

// ✅ NO AUTH REQUIRED for payment - GUESTS CAN PAY
router.post("/myfatoorah", createMyFatoorahPayment);
router.get("/success", handlePaymentSuccess); // ✅ GET not POST for callback
router.post("/webhook", handleWebhook);
module.exports = router;
