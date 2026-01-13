const express = require("express");
const router = express.Router();

// ✅ CORRECT IMPORT - Destructure properly
const {
  createMyFatoorahPayment,
  handlePaymentSuccess,
  handlePaymentFailed,
} = require("../App/controllers/paymentController"); // Your path

// ✅ ROUTES - Each handler is a FUNCTION
router.post("/myfatoorah", createMyFatoorahPayment); // Line 20 ✅
router.get("/success", handlePaymentSuccess);
router.get("/failed", handlePaymentFailed);

module.exports = router;
