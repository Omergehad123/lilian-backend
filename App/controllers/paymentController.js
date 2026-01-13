const axios = require("axios");

const createMyFatoorahPayment = async (req, res) => {
  try {
    console.log("📥 PAYMENT REQUEST:", req.body);

    // 🔥 VALIDATE INPUT
    const amount = parseFloat(req.body.amount);
    if (!amount || amount < 0.1) {
      return res.status(400).json({
        isSuccess: false,
        message: "Amount must be >= 0.100 KWD",
      });
    }

    // 🔥 NORMALIZE PHONE (your frontend already perfect)
    const customerPhone = (req.body.customer_phone || "96566123456")
      .replace(/\D/g, "")
      .slice(0, 10);

    const customerName = (req.body.customer_name || "Guest").substring(0, 100);
    const customerEmail = req.body.customer_email || "guest@lilian.com";

    // 🔥 MYFATOORAH KUWAIT CONFIG
    const API_KEY = process.env.MYFATOORAH_API_KEY; // SK_KWT_...
    const BASE_URL =
      process.env.MYFATOORAH_BASE_URL || "https://apitest.myfatoorah.com"; // TEST FIRST
    const paymentMethod = req.body.payment_method || "card";

    console.log("🔧 CONFIG:", { API_KEY: !!API_KEY, BASE_URL, paymentMethod });

    if (!API_KEY) {
      return res.status(500).json({
        isSuccess: false,
        message: "Payment gateway not configured",
      });
    }

    // 🔥 CORRECT PAYMENT METHOD IDS - KUWAIT
    const paymentMethodId = paymentMethod === "knet" ? 11 : 3;

    // 🔥 MYFATOORAH EXECUTE PAYMENT PAYLOAD
    const paymentPayload = {
      PaymentMethodId: paymentMethodId,
      InvoiceValue: Number(amount),
      CustomerName: customerName,
      CustomerEmail: customerEmail,
      CustomerMobile: customerPhone,
      CallBackUrl: `${
        process.env.FRONTEND_URL || "https://lilyandelarosekw.com"
      }/payment-success`,
      ErrorUrl: `${
        process.env.FRONTEND_URL || "https://lilyandelarosekw.com"
      }/payment-failed`,
      NotificationOption: "ALL",
      Lang: "en",
      DisplayCurrencyIso: "KWD",
    };

    console.log("🌐 MYFATOORAH PAYLOAD:", {
      PaymentMethodId,
      InvoiceValue: paymentPayload.InvoiceValue,
      CustomerMobile: customerPhone,
    });

    // 🔥 CALL MYFATOORAH API
    const response = await axios.post(
      `${BASE_URL}/connect/trx/v2/ExecutePayment`,
      paymentPayload,
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    console.log("✅ MYFATOORAH RESPONSE:", response.data);

    if (response.data.IsSuccess && response.data.Data?.PaymentURL) {
      res.json({
        isSuccess: true,
        paymentUrl: response.data.Data.PaymentURL,
        invoiceId: response.data.Data.InvoiceId,
      });
    } else {
      res.status(400).json({
        isSuccess: false,
        message: response.data.Message || "Invalid MyFatoorah response",
      });
    }
  } catch (error) {
    console.error("💥 MYFATOORAH ERROR:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      url: error.config?.url,
    });

    // 🔥 DETAILED ERROR MESSAGES
    if (error.response?.status === 400) {
      return res.status(400).json({
        isSuccess: false,
        message: `MyFatoorah: ${
          error.response.data.Message || "Invalid payment data"
        }`,
        debug: error.response.data,
      });
    }

    if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
      return res.status(503).json({
        isSuccess: false,
        message: "Payment gateway unavailable",
      });
    }

    res.status(400).json({
      isSuccess: false,
      message: error.response?.data?.Message || "Payment service error",
    });
  }
};

const handlePaymentSuccess = async (req, res) => {
  console.log("✅ PAYMENT SUCCESS:", req.query, req.body);
  const { paymentId, invoiceId } = req.query;

  res.redirect(
    `${
      process.env.FRONTEND_URL || "https://lilyandelarosekw.com"
    }/payment-success?paymentId=${paymentId || invoiceId}`
  );
};

const handlePaymentFailed = async (req, res) => {
  console.log("❌ PAYMENT FAILED:", req.query, req.body);
  res.redirect(
    `${
      process.env.FRONTEND_URL || "https://lilyandelarosekw.com"
    }/payment-failed?error=${req.query.error || "cancelled"}`
  );
};

const handleWebhook = async (req, res) => {
  console.log("🔔 WEBHOOK:", req.body);

  // TODO: Process payment status, update order
  const { InvoiceId, PaymentId } = req.body;

  res.status(200).json({ success: true });
};

module.exports = {
  createMyFatoorahPayment,
  handlePaymentSuccess,
  handlePaymentFailed,
  handleWebhook,
};
