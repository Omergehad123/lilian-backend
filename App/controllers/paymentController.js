const axios = require("axios");
const User = require("../models/users.model");

// 1. CREATE MYFATOORAH PAYMENT - UPDATED (طرق الدفع بس)
const createMyFatoorahPayment = async (req, res) => {
  try {
    console.log("📥 FULL REQUEST BODY:", JSON.stringify(req.body, null, 2));

    // ✅ Handle BOTH frontend payload structures
    const amountRaw = req.body.amount || req.body.orderData?.totalAmount;
    const customerName =
      req.body.customerName || req.body.orderData?.userInfo?.name;
    const customerEmail =
      req.body.customerEmail || req.body.orderData?.customerEmail;
    const phone = req.body.phone || req.body.orderData?.userInfo?.phone;
    const userId =
      req.body.userId || req.body.orderData?.user?._id || req.user?._id;

    // ✅ STRICT VALIDATION
    if (!amountRaw || !customerName || !customerEmail) {
      console.log("❌ MISSING:", {
        amountRaw,
        customerName,
        customerEmail,
        userId,
      });
      return res.status(400).json({
        isSuccess: false,
        message: `Missing: amount=${!!amountRaw}, name=${!!customerName}, email=${!!customerEmail}`,
      });
    }

    const amount = parseFloat(amountRaw);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        isSuccess: false,
        message: `Invalid amount: ${amountRaw} → ${amount}`,
      });
    }

    console.log(`✅ VALIDATED: ${amount} KWD for ${customerName}`);

    // ✅ Environment check
    if (!process.env.MYFATOORAH_API_KEY) {
      console.error("❌ NO API KEY in .env");
      return res.status(500).json({
        isSuccess: false,
        message: "Payment gateway not configured",
      });
    }

    // 1. INITIATE PAYMENT - فقط لجلب طرق الدفع
    const initiateRes = await axios.post(
      `${process.env.MYFATOORAH_BASE_URL}/v2/InitiatePayment`,
      {
        InvoiceAmount: amount,
        CurrencyIso: "KWD",
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.MYFATOORAH_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    console.log("✅ Initiate:", initiateRes.data.IsSuccess);

    if (!initiateRes.data.IsSuccess) {
      throw new Error(`Initiate failed: ${initiateRes.data.Message}`);
    }

    // ✅ NEW: Return payment methods for user selection
    const paymentMethods = initiateRes.data.Data.PaymentMethods || [];

    // Filter only active and popular methods
    const filteredMethods = paymentMethods.filter(
      (method) => method.IsEnabled && method.PaymentMethodDisplayName
    );

    console.log(`✅ Available payment methods: ${filteredMethods.length}`);

    res.json({
      isSuccess: true,
      paymentMethods: filteredMethods.map((method) => ({
        id: method.PaymentMethodId,
        name:
          method.PaymentMethodDisplayName || method.PaymentMethodEnglishName,
        logo: method.PaymentGatewayLogo || null,
        description: method.Description || null,
      })),
      invoiceId: initiateRes.data.Data.InvoiceId,
      amount,
      customerName,
      customerEmail,
      phone,
      userId,
    });
  } catch (error) {
    console.error("💥 DETAILED ERROR:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      config: error.config?.url,
    });

    res.status(500).json({
      isSuccess: false,
      message: error.response?.data?.Message || error.message,
    });
  }
};

// ✅ الكود الكامل جاهز للـ server
module.exports = {
  createMyFatoorahPayment,
};
