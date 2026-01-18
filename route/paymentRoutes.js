const express = require("express");
const router = express.Router();
const {
  createMyFatoorahPayment,
  handlePaymentSuccess,
  handleWebhook,
} = require("../App/controllers/paymentController");

router.post("/myfatoorah", createMyFatoorahPayment);
router.get("/success", handlePaymentSuccess);
router.post("/webhook", handleWebhook);

module.exports = router;
