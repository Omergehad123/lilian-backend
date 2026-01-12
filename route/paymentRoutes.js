const express = require("express");
const router = express.Router();
const PaymentController = require("../controllers/paymentController");

// ✅ WEBHOOK - RAW JSON (no body parser)
router.post(
  "/webhook/myfatoorah",
  express.raw({ type: "application/json" }),
  PaymentController.myFatoorahWebhook
);

// ✅ NORMAL PAYMENT ROUTES
router.post("/myfatoorah", PaymentController.createMyFatoorahPayment);
router.get("/status/:orderId", PaymentController.checkPaymentStatus);

module.exports = router;
