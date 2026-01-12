// routes/paymentRoutes.js
const express = require("express");
const router = express.Router();
const PaymentController = require("../App/controllers/paymentController");
const verifyCookieToken = require("../App/middleware/verifyCookieToken"); // ✅ COOKIE AUTH

// 🔥 COOKIE AUTH - Matches your frontend fetch
router.post(
  "/myfatoorah",
  verifyCookieToken,
  PaymentController.createMyFatoorahPayment
);
router.get("/status", verifyCookieToken, PaymentController.checkPaymentStatus);

// 🔥 WEBHOOK - PUBLIC (MyFatoorah posts here)
router.post(
  "/webhook/myfatoorah",
  express.raw({ type: "application/json" }),
  PaymentController.myFatoorahWebhook
);

module.exports = router;
