const express = require("express");
const router = express.Router();

const {
  createMyFatoorahPayment,
  handlePaymentSuccess,
  handlePaymentFailed,
  handleWebhook,
} = require("../App/controllers/paymentController");

router.post("/myfatoorah", createMyFatoorahPayment);
router.get("/success", handlePaymentSuccess);
router.get("/failed", handlePaymentFailed);
router.post("/webhook", handleWebhook);

module.exports = router;
