const express = require("express");
const router = express.Router();
const {
  createMyFatoorahPayment,
  handlePaymentSuccess,
  handleWebhook,
  testPaymentEndpoint,
} = require("../App/controllers/paymentController");

console.log("✅ Payment routes loaded");

// NO AUTH - GUESTS CAN PAY
router.post("/myfatoorah", createMyFatoorahPayment);
router.get("/success", handlePaymentSuccess);
router.post("/webhook", handleWebhook);        // ✅ MyFatoorah calls this
router.post("/test", testPaymentEndpoint);

module.exports = router;
