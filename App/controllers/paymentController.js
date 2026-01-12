const axios = require("axios");
const User = require("../models/users.model");

// 1. CREATE MYFATOORAH PAYMENT - UPDATED (طرق الدفع بس)
const createMyFatoorahPayment = async (req, res) => {
  try {
    console.log("📥 FULL REQUEST BODY:", JSON.stringify(req.body, null, 2));

    const amountRaw = req.body.amount || req.body.orderData?.totalAmount;
    const customerName =
      req.body.customerName || req.body.orderData?.userInfo?.name;
    const customerEmail =
      req.body.customerEmail || req.body.orderData?.customerEmail;
    const phone = req.body.phone || req.body.orderData?.userInfo?.phone;
    const userId =
      req.body.userId || req.body.orderData?.user?._id || req.user?._id;

    if (!amountRaw || !customerName || !customerEmail) {
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

    if (!process.env.MYFATOORAH_API_KEY) {
      return res.status(500).json({
        isSuccess: false,
        message: "Payment gateway not configured",
      });
    }

    // ✅ INITIATE PAYMENT
    console.log("🔄 Calling MyFatoorah InitiatePayment...");
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
        timeout: 15000,
      }
    );

    console.log("✅ Initiate Response:", {
      IsSuccess: initiateRes.data.IsSuccess,
      Message: initiateRes.data.Message,
      InvoiceId: initiateRes.data.Data?.InvoiceId,
      PaymentMethodsCount: initiateRes.data.Data?.PaymentMethods?.length || 0,
    });

    if (!initiateRes.data.IsSuccess) {
      console.error("❌ Initiate FAILED:", initiateRes.data);
      throw new Error(`Initiate failed: ${initiateRes.data.Message}`);
    }

    // ✅ DEBUG: Print ALL payment methods
    const allPaymentMethods = initiateRes.data.Data.PaymentMethods || [];
    console.log(
      "🔍 ALL Payment Methods:",
      JSON.stringify(allPaymentMethods, null, 2)
    );

    // ✅ DEBUG: أقل شروط - كل الـ methods اللي فيها اسم
    const filteredMethods = allPaymentMethods.filter(
      (method) =>
        method.PaymentMethodDisplayName || method.PaymentMethodEnglishName
    );

    console.log(
      "🔍 Filtered Methods:",
      filteredMethods.length,
      filteredMethods.map((m) => ({
        id: m.PaymentMethodId,
        name: m.PaymentMethodDisplayName || m.PaymentMethodEnglishName,
        enabled: m.IsEnabled,
      }))
    );

    // ✅ حتى لو مفيش methods، رجّع كلهم للـ debug
    res.json({
      isSuccess: true,
      debug: {
        totalMethods: allPaymentMethods.length,
        filteredMethods: filteredMethods.length,
        allMethods: allPaymentMethods.slice(0, 5), // أول 5 بس
      },
      paymentMethods: filteredMethods.map((method) => ({
        id: method.PaymentMethodId,
        name:
          method.PaymentMethodDisplayName ||
          method.PaymentMethodEnglishName ||
          "Unknown",
        logo: method.PaymentGatewayLogo || null,
        description: method.Description || null,
        isEnabled: method.IsEnabled,
      })),
      invoiceId: initiateRes.data.Data.InvoiceId,
      amount,
      customerName,
      customerEmail,
      phone,
      userId,
    });
  } catch (error) {
    console.error("💥 FULL ERROR:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      config: error.config?.url,
    });

    res.status(500).json({
      isSuccess: false,
      debug: {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data?.Message,
      },
      message: error.response?.data?.Message || error.message,
    });
  }
};

module.exports = { createMyFatoorahPayment };

// ✅ الكود الكامل جاهز للـ server
module.exports = {
  createMyFatoorahPayment,
};
