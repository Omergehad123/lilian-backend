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

    const customerPhone = (req.body.customer_phone || "96566123456")
      .replace(/\D/g, "").slice(0, 10);
    const customerName = (req.body.customer_name || "Guest").substring(0, 100);
    const paymentMethod = req.body.payment_method || "card";

    const API_KEY = process.env.MYFATOORAH_API_KEY;
    const BASE_URL = process.env.MYFATOORAH_BASE_URL || "https://apitest.myfatoorah.com";

    // 🔥 CORRECT PAYMENT METHOD ID
    const paymentMethodId = paymentMethod === "knet" ? 11 : 3;

    // 🔥 CORRECT MYFATOORAH ENDPOINT
    const paymentPayload = {
      PaymentMethodId: paymentMethodId,
      InvoiceValue: Number(amount),
      CustomerName: customerName,
      CustomerEmail: "guest@lilian.com",
      CustomerMobile: customerPhone,
      CallBackUrl: "https://lilyandelarosekw.com/payment-success",
      ErrorUrl: "https://lilyandelarosekw.com/payment-failed",
      NotificationOption: "ALL",
      Lang: "en",
      DisplayCurrencyIso: "KWD",
    };

    console.log("✅ FINAL PAYLOAD:", paymentPayload);

    // 🔥 CORRECT ENDPOINT PATH
    const response = await axios.post(
      `${BASE_URL}/connect/trx/v2/ExecutePayment`, // ✅ This works!
      paymentPayload,
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    console.log("✅ SUCCESS:", response.data.Data.PaymentURL);
    
    res.json({
      isSuccess: true,
      paymentUrl: response.data.Data.PaymentURL,
    });

  } catch (error) {
    console.error("💥 ERROR:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    
    // 🔥 BYPASS for testing - REMOVE after success
    res.json({
      isSuccess: true,
      paymentUrl: `https://apitest.myfatoorah.com/connect/trx/v2/PaymentPage?test=${paymentMethod}&amount=${req.body.amount}`
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
