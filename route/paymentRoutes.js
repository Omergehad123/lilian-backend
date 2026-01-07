const express = require("express");
const router = express.Router();

const {
  createMyFatoorahPayment,
  handlePaymentSuccess,
} = require("../App/controllers/paymentController"); // ✅ نفس المسار

router.post("/myfatoorah", createMyFatoorahPayment);
router.get("/success", handlePaymentSuccess);

module.exports = router;
