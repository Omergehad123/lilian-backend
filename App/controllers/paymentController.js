const axios = require("axios");

const createMyFatoorahPayment = async (req, res) => {
  try {
    console.log("📥 PAYMENT REQUEST:", req.body);

    const amount = parseFloat(req.body.amount);
    if (!amount || amount < 0.1) {
      return res.status(400).json({
        isSuccess: false,
        message: "Amount must be >= 0.100 KWD",
      });
    }

    // ✅ EXTRACT & NORMALIZE - Your frontend is perfect
    const customerPhone = (req.body.customer_phone || "96566123456")
      .replace(/\D/g, "")
      .slice(0, 10);

    const customerName = (req.body.customer_name || "Guest Customer").substring(
      0,
      100
    );
    const customerEmail = "guest@lilian.com";
    const paymentMethod = req.body.payment_method || "card";

    // 🔥 MYFATOORAH KUWAIT CONFIG
    const API_KEY = process.env.MYFATOORAH_API_KEY;
    const BASE_URL =
      process.env.MYFATOORAH_BASE_URL || "https://apitest.myfatoorah.com";

    if (!API_KEY) {
      return res.status(500).json({ isSuccess: false, message: "No API key" });
    }

    // ✅ FIXED: PaymentMethodId CORRECTLY SET
    const paymentMethodId = paymentMethod === "knet" ? 11 : 3;

    // 🔥 COMPLETE MYFATOORAH PAYLOAD - PaymentMethodId FIRST
    const paymentPayload = {
      PaymentMethodId: paymentMethodId, // ✅ 3=Card, 11=KNET
      InvoiceValue: Number(amount),
      CustomerName: customerName,
      CustomerEmail: customerEmail,
      CustomerMobile: customerPhone,
      CallBackUrl: "https://lilyandelarosekw.com/payment-success",
      ErrorUrl: "https://lilyandelarosekw.com/payment-failed",
      NotificationOption: "ALL",
      Lang: "en",
      DisplayCurrencyIso: "KWD",
    };

    console.log("✅ PAYLOAD BUILT:", {
      PaymentMethodId: paymentPayload.PaymentMethodId,
      InvoiceValue: paymentPayload.InvoiceValue,
      CustomerMobile: paymentPayload.CustomerMobile,
    });

    // 🔥 CALL MYFATOORAH
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

    console.log("✅ MYFATOORAH SUCCESS:", response.data.Data?.PaymentURL);

    res.json({
      isSuccess: true,
      paymentUrl: response.data.Data.PaymentURL,
      invoiceId: response.data.Data.InvoiceId,
    });
  } catch (error) {
    console.error("💥 ERROR:", error.response?.data || error.message);

    res.status(400).json({
      isSuccess: false,
      message:
        error.response?.data?.Message || error.message || "Payment failed",
    });
  }
};

const handlePaymentSuccess = async (req, res) => {
  const { paymentId, invoiceId } = req.query;
  res.redirect(
    `https://lilyandelarosekw.com/payment-success?paymentId=${
      paymentId || invoiceId
    }`
  );
};

const handlePaymentFailed = async (req, res) => {
  res.redirect(
    `https://lilyandelarosekw.com/payment-failed?error=${
      req.query.error || "cancelled"
    }`
  );
};

const handleWebhook = async (req, res) => {
  console.log("🔔 WEBHOOK:", req.body);
  res.status(200).json({ success: true });
};

module.exports = {
  createMyFatoorahPayment,
  handlePaymentSuccess,
  handlePaymentFailed,
  handleWebhook,
};
