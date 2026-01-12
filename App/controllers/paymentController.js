const axios = require("axios");
const User = require("../models/users.model");

const createMyFatoorahPayment = async (req, res) => {
  try {
    console.log("📥 FULL REQUEST:", JSON.stringify(req.body, null, 2));

    // ✅ Extract data with paymentMethod support
    const paymentMethod = req.body.paymentMethod; // "card" or "knet"
    const amountRaw = req.body.amount || req.body.orderData?.totalAmount;
    const customerName =
      req.body.customerName ||
      req.body.orderData?.userInfo?.name ||
      "Guest Customer";
    const customerEmail =
      req.body.customerEmail ||
      req.body.orderData?.customerEmail ||
      "customer@lilian.com";
    const phone =
      req.body.phone || req.body.orderData?.userInfo?.phone || "96500000000";
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

    console.log(
      `✅ Processing ${amount} KWD | Method: ${
        paymentMethod || "auto"
      } | User: ${userId}`
    );

    // ✅ API KEY CHECK
    if (!process.env.MYFATOORAH_API_KEY) {
      return res
        .status(500)
        .json({ isSuccess: false, message: "Payment gateway not configured" });
    }

    // 🔥 SIMPLIFIED APPROACH - Direct ExecutePayment with method ID
    let paymentMethodId;
    if (paymentMethod === "knet") {
      paymentMethodId = 1; // KNET
      console.log("🎯 KNET selected - PaymentMethodId: 1");
    } else {
      paymentMethodId = 2; // CARD (default)
      console.log("🎯 CARD selected - PaymentMethodId: 2");
    }

    // 1. DIRECT EXECUTE PAYMENT - NO Initiate needed
    const executeRes = await axios.post(
      `${process.env.MYFATOORAH_BASE_URL}/v2/ExecutePayment`,
      {
        PaymentMethodId: paymentMethodId,
        InvoiceValue: amount,
        CustomerName: customerName,
        CustomerEmail: customerEmail,
        CustomerMobile: phone,
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
        }),
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.MYFATOORAH_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    console.log("✅ Execute Response:", {
      success: executeRes.data.IsSuccess,
      paymentUrl: !!executeRes.data.Data?.PaymentURL,
    });

    if (!executeRes.data.IsSuccess || !executeRes.data.Data.PaymentURL) {
      console.error("❌ Execute failed:", executeRes.data);
      return res.status(400).json({
        isSuccess: false,
        message: executeRes.data.Message || "Payment execution failed",
      });
    }

    console.log("🎉 SUCCESS! PaymentURL:", executeRes.data.Data.PaymentURL);
    res.json({
      isSuccess: true,
      paymentUrl: executeRes.data.Data.PaymentURL,
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

// Keep other functions unchanged
const handlePaymentSuccess = async (req, res) => {
  try {
    console.log("📥 SUCCESS CALLBACK:", req.query);
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
    console.error("❌ Success handler error:", error);
    res.redirect(
      `${
        process.env.FRONTEND_URL || "https://lilyandelarosekw.com"
      }/payment-failed?error=server_error`
    );
  }
};

const handleWebhook = async (req, res) => {
  try {
    console.log("🔔 WEBHOOK:", req.body);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("❌ Webhook error:", error);
    res.status(500).json({ success: false });
  }
};

module.exports = {
  createMyFatoorahPayment,
  handlePaymentSuccess,
  handleWebhook,
};
