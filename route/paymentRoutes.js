const express = require("express");
const router = express.Router();

const {
  createMyFatoorahPayment,
  handlePaymentSuccess,
  handleWebhook,
  testPaymentEndpoint,
} = require("../App/controllers/paymentController");

// Guests allowed
router.post("/myfatoorah", createMyFatoorahPayment);
router.get("/success", handlePaymentSuccess);
router.post("/webhook", handleWebhook);
router.post("/test", testPaymentEndpoint);

module.exports = router;
