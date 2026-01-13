const axios = require("axios");

const createMyFatoorahPayment = async (req, res) => {
  try {
    console.log("📥 FULL REQUEST:", JSON.stringify(req.body, null, 2));

    // 🔥 SUPPORT YOUR FRONTEND FIELD NAMES + BACKWARDS COMPAT
    const paymentMethod =
      req.body.payment_method || req.body.paymentMethod || "card";
    const amountRaw = req.body.amount || req.body.orderData?.totalAmount;
    const customerName =
      req.body.customer_name ||
      req.body.customerName ||
      req.body.orderData?.userInfo?.name ||
      "Guest Customer";
    const customerEmail =
      req.body.customerEmail ||
      req.body.orderData?.customerEmail ||
      "customer@lilian.com";
    const phone =
      req.body.customer_phone ||
      req.body.phone ||
      req.body.orderData?.userInfo?.phone ||
      "96500000000";
    const userId =
      req.body.userId ||
      req.body.orderData?.user?._id ||
      req.user?._id ||
      "guest";

    // ✅ VALIDATION
    if (!amountRaw) {
      return res
        .status(400)
        .json({ isSuccess: false, message: "Amount is required" });
    }

    const amount = parseFloat(amountRaw);
    if (isNaN(amount) || amount < 0.1) {
      return res
        .status(400)
        .json({ isSuccess: false, message: "Minimum amount is 0.100 KWD" });
    }

    // ✅ PHONE NORMALIZATION
    const cleanPhone = phone.replace(/\D/g, "").slice(0, 10);

    console.log(
      `✅ Processing ${amount} KWD | Method: ${paymentMethod} | Phone: ${cleanPhone} | User: ${userId}`
    );

    // ✅ API CONFIG
    if (!process.env.MYFATOORAH_API_KEY) {
      return res
        .status(500)
        .json({ isSuccess: false, message: "Payment gateway not configured" });
    }

    // 🔥 PAYMENT METHOD IDS (your working values)
    let paymentMethodId;
    if (paymentMethod === "knet") {
      paymentMethodId = 1; // KNET
      console.log("🎯 KNET selected - PaymentMethodId: 1");
    } else {
      paymentMethodId = 2; // CARD
      console.log("🎯 CARD selected - PaymentMethodId: 2");
    }

    // 🔥 LIVE MYFATOORAH EXECUTE PAYMENT
    const executeRes = await axios.post(
      `${
        process.env.MYFATOORAH_BASE_URL || "https://api.myfatoorah.com"
      }/v2/ExecutePayment`,
      {
        PaymentMethodId: paymentMethodId,
        InvoiceValue: amount,
        CustomerName: customerName,
        CustomerEmail: customerEmail,
        CustomerMobile: cleanPhone,
        CallBackUrl: `${
          process.env.FRONTEND_URL || "https://lilyandelarosekw.com"
        }/payment-success`,
        ErrorUrl: `${
          process.env.FRONTEND_URL || "https://lilyandelarosekw.com"
        }/payment-failed`,
        NotificationOption: "ALL",
        Lang: "en",
        DisplayCurrencyIso: "KWD",
        UserDefinedField: JSON.stringify({
          userId,
          orderData: req.body.orderData || req.body,
          paymentMethod,
          timestamp: new Date().toISOString(),
        }),
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.MYFATOORAH_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    console.log("✅ MyFatoorah SUCCESS:", {
      isSuccess: executeRes.data.IsSuccess,
      paymentUrl: !!executeRes.data.Data?.PaymentURL,
      invoiceId: executeRes.data.Data?.InvoiceId,
    });

    if (!executeRes.data.IsSuccess || !executeRes.data.Data?.PaymentURL) {
      console.error("❌ MyFatoorah failed:", executeRes.data);
      return res.status(400).json({
        isSuccess: false,
        message: executeRes.data.Message || "Payment execution failed",
      });
    }

    console.log("🎉 LIVE PAYMENT URL:", executeRes.data.Data.PaymentURL);
    res.json({
      isSuccess: true,
      paymentUrl: executeRes.data.Data.PaymentURL,
      invoiceId: executeRes.data.Data.InvoiceId,
    });
  } catch (error) {
    console.error("💥 FULL ERROR:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      url: error.config?.url,
    });

    res.status(500).json({
      isSuccess: false,
      message:
        error.response?.data?.Message ||
        error.message ||
        "Payment gateway error",
    });
  }
};

const handlePaymentSuccess = async (req, res) => {
  try {
    console.log("✅ PAYMENT SUCCESS:", req.query);
    const { paymentId, invoiceId } = req.query;

    if (!paymentId && !invoiceId) {
      return res.redirect(
        `${
          process.env.FRONTEND_URL || "https://lilyandelarosekw.com"
        }/payment-failed?error=no_payment_id`
      );
    }

    res.redirect(
      `${
        process.env.FRONTEND_URL || "https://lilyandelarosekw.com"
      }/payment-success?paymentId=${paymentId || invoiceId}`
    );
  } catch (error) {
    console.error("❌ Success redirect error:", error);
    res.redirect(
      `${
        process.env.FRONTEND_URL || "https://lilyandelarosekw.com"
      }/payment-failed?error=server_error`
    );
  }
};

const handlePaymentFailed = async (req, res) => {
  try {
    console.log("❌ PAYMENT FAILED:", req.query);
    res.redirect(
      `${
        process.env.FRONTEND_URL || "https://lilyandelarosekw.com"
      }/payment-failed?error=${req.query.error || "cancelled"}`
    );
  } catch (error) {
    console.error("❌ Failed redirect error:", error);
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

    // TODO: Update order status in database
    const { InvoiceId, PaymentId } = req.body;

    res.status(200).json({ success: true, message: "Webhook processed" });
  } catch (error) {
    console.error("❌ Webhook error:", error);
    res.status(500).json({ success: false });
  }
};

module.exports = {
  createMyFatoorahPayment,
  handlePaymentSuccess,
  handlePaymentFailed,
  handleWebhook,
};
