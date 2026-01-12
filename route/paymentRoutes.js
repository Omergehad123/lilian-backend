const express = require("express");
const router = express.Router();

const verifyCookieToken = require("../App/middleware/verifyCookieToken");

const {
  createMyFatoorahPayment,
  handlePaymentSuccess,
} = require("../App/controllers/paymentController");

console.log("✅ Middleware loaded:", typeof verifyCookieToken === "function");

router.post("/myfatoorah", verifyCookieToken, createMyFatoorahPayment);
router.post("/success", verifyCookieToken, handlePaymentSuccess);

module.exports = router;
