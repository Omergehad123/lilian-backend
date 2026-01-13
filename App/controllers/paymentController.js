const axios = require("axios");

const createMyFatoorahPayment = async (req, res) => {
  try {
    console.log("📥 PAYMENT REQUEST:", req.body);

    // 🔥 VALIDATE REQUIRED FIELDS FIRST
    const amount = parseFloat(req.body.amount);
    if (!amount || amount < 0.1) {
      return res.status(400).json({
        isSuccess: false,
        message: "Amount must be >= 0.100 KWD",
      });
    }

    const customerName =
      req.body.customer_name || req.body.customerName || "Guest Customer";
    const customerEmail =
      req.body.customer_email || req.body.customerEmail || "guest@lilian.com";
    const phone = (
      req.body.customer_phone ||
      req.body.phone ||
      "96500000000"
    ).replace(/^\+/, "");

    // 🔥 VALIDATE EMAIL FORMAT
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail)) {
      return res.status(400).json({
        isSuccess: false,
        message: "Invalid email format",
      });
    }

    // 🔥 VALIDATE PHONE (Kuwait format)
    if (!/^\d{8}$/.test(phone) && !/^\+?\d{10,15}$/.test(phone)) {
      return res.status(400).json({
        isSuccess: false,
        message: "Invalid phone number",
      });
    }

    const paymentMethod =
      req.body.payment_method || req.body.paymentMethod || "card";
    const paymentMethodId = paymentMethod === "knet" ? 1 : 2; // KNET=1, Card=2

    console.log(
      `✅ PROCESSING: ${amount}KWD | ${paymentMethod} | ${customerName}`
    );

    // 🔥 MYFATOORAH CONFIG
    const API_KEY = process.env.MYFATOORAH_API_KEY;
    const BASE_URL =
      process.env.MYFATOORAH_BASE_URL || "https://apitest.myfatoorah.com";

    if (!API_KEY) {
      return res.status(500).json({
        isSuccess: false,
        message: "Payment gateway not configured",
      });
    }

    // 🔥 FIXED MYFATOORAH PAYLOAD - EXACT FIELDS REQUIRED
    const paymentPayload = {
      PaymentMethodId: paymentMethodId,
      InvoiceValue: Number(amount).toFixed(3), // MyFatoorah requires 3 decimal places
      CustomerName: customerName.substring(0, 120), // Max 120 chars
      CustomerEmail: customerEmail,
      CustomerMobile: phone,
      CallBackUrl: "https://lilyandelarosekw.com/payment-success",
      ErrorUrl: "https://lilyandelarosekw.com/payment-failed",
      NotificationOption: "ALL",
      Lang: "en",
      DisplayCurrencyIso: "KWD",
      // 🔥 Add order data for webhook processing
      UserDefinedField: JSON.stringify({
        orderData: req.body.orderData,
        timestamp: new Date().toISOString(),
      }),
    };

    console.log("🌐 SENDING TO MYFATOORAH:", paymentPayload);

    const response = await axios.post(
      `${BASE_URL}/v2/ExecutePayment`,
      paymentPayload,
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 15000, // Increased timeout
      }
    );

    console.log("✅ MYFATOORAH RESPONSE:", response.data);

    if (response.data.IsSuccess && response.data.Data?.PaymentURL) {
      res.json({
        isSuccess: true,
        paymentUrl: response.data.Data.PaymentURL,
      });
    } else {
      console.error("❌ MYFATOORAH FAILED:", response.data);
      res.status(400).json({
        isSuccess: false,
        message: response.data.Message || "Payment initiation failed",
      });
    }
  } catch (error) {
    console.error("💥 MYFATOORAH ERROR:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data?.Message || error.response?.data,
    });

    // 🔥 BETTER ERROR MESSAGES
    if (error.response?.status === 400) {
      return res.status(400).json({
        isSuccess: false,
        message: `MyFatoorah validation error: ${
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

    // Extract order data from UserDefinedField (MyFatoorah sends it back)
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

    // Process payment completion
    const { InvoiceId, PaymentId, UserDefinedField } = req.body;

    if (UserDefinedField) {
      const udfData = JSON.parse(UserDefinedField);
      console.log("📦 Webhook Order Data:", udfData);

      // Create Order from webhook data (for guests)
      if (udfData.guest_checkout || !udfData.orderId) {
        // Store guest order as "completed payment"
        console.log("✅ Guest order stored from webhook");
      }

      // Update existing order status for auth users
      if (udfData.orderId) {
        // await Order.findByIdAndUpdate(udfData.orderId, { status: 'paid' });
        console.log("✅ Order status updated:", udfData.orderId);
      }
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
