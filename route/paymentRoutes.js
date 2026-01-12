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

router.post("/myfatoorah/initiate", verifyCookieToken, createMyFatoorahPayment);
router.post("/myfatoorah/execute", verifyCookieToken, executeSelectedPayment);

module.exports = router;
