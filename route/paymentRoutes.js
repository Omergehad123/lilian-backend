const express = require("express");
const router = express.Router();
const {
  createMyFatoorahPayment,
  handlePaymentSuccess,
  handleWebhook,
} = require("../App/controllers/paymentController");

console.log("✅ Payment routes loaded");

// NO AUTH - GUESTS CAN PAY
router.post("/myfatoorah", createMyFatoorahPayment);
router.get("/success", handlePaymentSuccess);
router.post("/webhook", handleWebhook); // MyFatoorah webhook

module.exports = router;
