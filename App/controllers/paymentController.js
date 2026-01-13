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

    // 🔥 SMART PHONE NORMALIZATION - WORKS FOR ANY COUNTRY
    const normalizePhoneForMyFatoorah = (phone) => {
      if (!phone) return "96566123456"; // Kuwait fallback

      // Remove all non-digits
      let cleanPhone = phone.replace(/\D/g, "");

      // Kuwaiti: 965 + 8 digits (keep as-is)
      if (cleanPhone.startsWith("965") && cleanPhone.length >= 12) {
        return cleanPhone.slice(0, 10); // 96566123456
      }

      // Egyptian: 20xxxxxxxxx → 965 + last 8 digits
      if (cleanPhone.startsWith("20") && cleanPhone.length >= 11) {
        return "965" + cleanPhone.slice(-8);
      }

      // UAE: 971xxxxxxxxx → 965 + last 8 digits
      if (cleanPhone.startsWith("971") && cleanPhone.length >= 11) {
        return "965" + cleanPhone.slice(-8);
      }

      // Saudi: 966xxxxxxxxx → 965 + last 8 digits
      if (cleanPhone.startsWith("966") && cleanPhone.length >= 11) {
        return "965" + cleanPhone.slice(-8);
      }

      // Any international: 965 + last 8 digits
      if (cleanPhone.length >= 8) {
        return "965" + cleanPhone.slice(-8);
      }

      return "96566123456"; // Final fallback
    };

    const customerName = (
      req.body.customer_name ||
      req.body.customerName ||
      "Guest Customer"
    ).substring(0, 120);
    const customerEmail =
      req.body.customer_email || req.body.customerEmail || "guest@lilian.com";
    const customerPhone = normalizePhoneForMyFatoorah(
      req.body.customer_phone || req.body.phone
    );
    const paymentMethod =
      req.body.payment_method || req.body.paymentMethod || "card";

    // 🔥 VALIDATE EMAIL
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail)) {
      return res.status(400).json({
        isSuccess: false,
        message: "Invalid email format",
      });
    }

    console.log(
      `✅ PROCESSING: ${amount}KWD | ${paymentMethod} | ${customerName} | ${customerPhone}`
    );

    // 🔥 MYFATOORAH CONFIG
    const API_KEY = process.env.MYFATOORAH_API_KEY;
    const BASE_URL =
      process.env.MYFATOORAH_BASE_URL || "https://apitest.myfatoorah.com";

    if (!API_KEY) {
      console.error("❌ NO MYFATOORAH_API_KEY in .env");
      return res.status(500).json({
        isSuccess: false,
        message: "Payment gateway not configured",
      });
    }

    // 🔥 KUWAIT PAYMENT METHOD IDS
    const paymentMethodId = paymentMethod === "knet" ? 1 : 3; // KNET=1, CARD=3

    // 🔥 COMPLETE MYFATOORAH PAYLOAD
    const paymentPayload = {
      PaymentMethodId: paymentMethodId,
      InvoiceValue: Number(amount).toFixed(3),
      CustomerName: customerName,
      CustomerEmail: customerEmail,
      CustomerMobile: customerPhone,
      CallBackUrl: "https://lilyandelarosekw.com/payment-success",
      ErrorUrl: "https://lilyandelarosekw.com/payment-failed",
      NotificationOption: "ALL",
      Lang: "en",
      DisplayCurrencyIso: "KWD",
      UserDefinedField: JSON.stringify({
        orderData: req.body.orderData,
        customerPhone: customerPhone,
        timestamp: new Date().toISOString(),
      }),
    };

    console.log("🌐 SENDING TO MYFATOORAH:", {
      PaymentMethodId: paymentPayload.PaymentMethodId,
      InvoiceValue: paymentPayload.InvoiceValue,
      CustomerMobile: paymentPayload.CustomerMobile,
    });

    // 🔥 EXECUTE PAYMENT
    const response = await axios.post(
      `${BASE_URL}/v2/ExecutePayment`,
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

    if (response.data.IsSuccess && response.data.Data?.PaymentURL) {
      res.json({
        isSuccess: true,
        paymentUrl: response.data.Data.PaymentURL,
      });
    } else {
      console.error("❌ MYFATOORAH REJECTED:", response.data);
      res.status(400).json({
        isSuccess: false,
        message: response.data.Message || "Payment initiation failed",
      });
    }
  } catch (error) {
    console.error("💥 MYFATOORAH ERROR:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });

    // 🔥 SPECIFIC ERROR HANDLING
    if (error.response?.status === 400) {
      return res.status(400).json({
        isSuccess: false,
        message: `MyFatoorah validation: ${
          error.response.data?.Message || error.message
        }`,
      });
    }

    res.status(500).json({
      isSuccess: false,
      message: `Payment service error: ${
        error.response?.data?.Message || error.message
      }`,
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
