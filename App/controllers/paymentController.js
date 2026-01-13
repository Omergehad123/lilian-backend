const axios = require("axios");
const createMyFatoorahPayment = async (req, res) => {
  try {
    console.log("📥 PAYMENT REQUEST:", req.body);

    // 🔥 VALIDATE AMOUNT
    const amount = parseFloat(req.body.amount);
    if (!amount || amount < 0.1) {
      return res.status(400).json({
        isSuccess: false,
        message: "Amount must be >= 0.100 KWD",
      });
    }

    // 🔥 PHONE NORMALIZATION (already working)
    const normalizePhoneForMyFatoorah = (phone) => {
      let cleanPhone = phone.replace(/\D/g, "");
      if (cleanPhone.startsWith("965") && cleanPhone.length >= 10) {
        return cleanPhone.slice(0, 10);
      }
      if (cleanPhone.length >= 8) {
        return "965" + cleanPhone.slice(-8);
      }
      return "96566123456";
    };

    const customerName = (req.body.customer_name || "Guest Customer").substring(
      0,
      120
    );
    const customerEmail = req.body.customer_email || "guest@lilian.com";
    const customerPhone = normalizePhoneForMyFatoorah(req.body.customer_phone);
    const paymentMethod = req.body.payment_method || "card";

    // 🔥 CORRECT MYFATOORAH KUWAIT PAYMENT IDS
    const paymentMethodId = paymentMethod === "knet" ? 11 : 3; // ✅ FIXED!

    console.log(
      `✅ PROCESSING: ${amount}KWD | ${paymentMethod}(${paymentMethodId})`
    );

    // 🔥 MYFATOORAH API CALL
    const API_KEY = process.env.MYFATOORAH_API_KEY;
    const BASE_URL = "https://apitest.myfatoorah.com"; // Test mode

    const paymentPayload = {
      PaymentMethodId: paymentMethodId, // ✅ 3=Card, 11=KNET
      InvoiceValue: Number(amount).toFixed(3),
      CustomerName: customerName,
      CustomerEmail: customerEmail,
      CustomerMobile: customerPhone,
      CallBackUrl: "https://lilyandelarosekw.com/payment-success",
      ErrorUrl: "https://lilyandelarosekw.com/payment-failed",
      NotificationOption: "ALL",
      Lang: "en",
      DisplayCurrencyIso: "KWD",
    };

    const response = await axios.post(
      `${BASE_URL}/connect/trx/v2/ExecutePayment`,
      paymentPayload,
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    console.log("✅ MYFATOORAH SUCCESS:", response.data.Data?.PaymentURL);

    res.json({
      isSuccess: true,
      paymentUrl: response.data.Data.PaymentURL,
    });
  } catch (error) {
    console.error("💥 ERROR:", error.response?.data || error.message);
    res.status(400).json({
      isSuccess: false,
      message: error.response?.data?.Message || "Payment failed",
    });
  }
};

const handlePaymentSuccess = async (req, res) => {
  try {
    console.log("📥 SUCCESS CALLBACK:", req.query, req.body);
    const { paymentId, invoiceId } = req.query;

    // Extract order data from UserDefinedField
    const udf = req.query.udf || req.body.UserDefinedField;
    console.log("🔍 UDF Data:", udf);

    if (paymentId || invoiceId) {
      return res.redirect(
        `${
          process.env.FRONTEND_URL || "https://lilyandelarosekw.com"
        }/payment-success?` +
          `paymentId=${paymentId || invoiceId}&status=success`
      );
    }

    res.redirect(
      `${
        process.env.FRONTEND_URL || "https://lilyandelarosekw.com"
      }/payment-failed?error=no_payment_id`
    );
  } catch (error) {
    console.error("❌ Success handler error:", error);
    res.redirect(
      `${
        process.env.FRONTEND_URL || "https://lilyandelarosekw.com"
      }/payment-failed?error=server_error`
    );
  }
};

const handlePaymentFailed = async (req, res) => {
  try {
    console.log("❌ FAILED CALLBACK:", req.query, req.body);
    res.redirect(
      `${
        process.env.FRONTEND_URL || "https://lilyandelarosekw.com"
      }/payment-failed?` + `error=${req.query.error || "cancelled"}`
    );
  } catch (error) {
    console.error("❌ Failed handler error:", error);
    res.redirect(
      `${
        process.env.FRONTEND_URL || "https://lilyandelarosekw.com"
      }/payment-failed?error=server_error`
    );
  }
};

const handleWebhook = async (req, res) => {
  try {
    console.log("🔔 WEBHOOK RECEIVED:", req.body);

    const { InvoiceId, PaymentId, UserDefinedField } = req.body;

    if (UserDefinedField) {
      const udfData = JSON.parse(UserDefinedField);
      console.log("📦 Webhook Order Data:", udfData);
    }

    res.status(200).json({ success: true, message: "Webhook processed" });
  } catch (error) {
    console.error("❌ Webhook error:", error);
    res.status(500).json({ success: false, message: "Webhook failed" });
  }
};

module.exports = {
  createMyFatoorahPayment,
  handlePaymentSuccess,
  handlePaymentFailed,
  handleWebhook,
};
