const express = require("express");
const router = express.Router();

// 🔥 IMPORT - Match your controller EXACTLY
const {
  createMyFatoorahPayment,
  handlePaymentSuccess,
  handleWebhook,
} = require("../App/controllers/paymentController");

// 🔥 ROUTES - Line 14 fixed
router.post("/myfatoorah", createMyFatoorahPayment); // ✅ POST works
router.get("/success", handlePaymentSuccess); // ✅ Line 14 FIXED
router.post("/webhook", handleWebhook); // ✅ Webhook

module.exports = router;
