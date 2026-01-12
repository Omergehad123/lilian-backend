const express = require("express");
const router = express.Router();

const verifyCookieToken = require("../App/middleware/verifyCookieToken");

// ✅ فقط الـ function المتاح
const {
  createMyFatoorahPayment,
} = require("../App/controllers/paymentController");

console.log("✅ Middleware loaded:", typeof verifyCookieToken === "function");
console.log(
  "✅ createMyFatoorahPayment loaded:",
  typeof createMyFatoorahPayment === "function"
);

// ✅ Route واحد بس دلوقتي
router.post("/myfatoorah/initiate", verifyCookieToken, createMyFatoorahPayment);

// ✅ للتوافق مع الكود القديم
router.post("/myfatoorah", verifyCookieToken, createMyFatoorahPayment);

module.exports = router;
