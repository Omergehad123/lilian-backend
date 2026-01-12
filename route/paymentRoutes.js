// routes/paymentRoutes.js
const express = require("express");
const router = express.Router();
const PaymentController = require("../App/controllers/paymentController");
const { protect } = require("../middleware/authMiddleware");

// In paymentRoutes.js
router.post("/myfatoorah", protect, PaymentController.createMyFatoorahPayment);
router.post(
  "/webhook/myfatoorah",
  express.raw({ type: "application/json" }),
  PaymentController.myFatoorahWebhook
);
router.get("/status", protect, PaymentController.checkPaymentStatus);

module.exports = router;
