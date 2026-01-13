const express = require("express");
const router = express.Router();

// Import controllers
const {
  createMyFatoorahPayment,
  handlePaymentSuccess,
  handlePaymentFailed,
  handleWebhook,
} = require("../App/controllers/paymentController");

// 🔥 PUBLIC - No auth required for payment initiation
router.post("/myfatoorah", createMyFatoorahPayment);

// 🔥 CALLBACKS - MyFatoorah redirects here
router.get("/success", handlePaymentSuccess);
router.get("/failed", handlePaymentFailed);

// 🔥 WEBHOOK - MyFatoorah posts payment status
router.post("/webhook", handleWebhook);

module.exports = router;
