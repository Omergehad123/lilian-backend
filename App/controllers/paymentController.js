const axios = require("axios");
const User = require("../models/users.model");

const createMyFatoorahPayment = async (req, res) => {
  try {
    console.log("📥 FULL REQUEST:", JSON.stringify(req.body, null, 2));

    // ✅ FIXED: Match frontend payload exactly
    const {
      amount,
      customerName,
      customerPhone,
      paymentMethod,
      customerEmail,
      orderData,
      userId,
    } = req.body;

    // ✅ BACKWARDS COMPATIBILITY - handle both snake_case and camelCase
    const finalPaymentMethod = paymentMethod || req.body.payment_method;
    const finalAmount =
      amount || req.body.amountRaw || req.body.orderData?.totalAmount;
    const finalCustomerName =
      customerName || req.body.customer_name || "Guest Customer";
    const finalCustomerEmail =
      customerEmail || req.body.customer_email || "customer@lilian.com";
    const finalPhone =
      customerPhone || req.body.customer_phone || "96500000000";
    const finalUserId = userId || req.body.userId || "guest";

    console.log("🔍 PROCESSED:", {
      finalAmount,
      finalPaymentMethod,
      finalCustomerName,
      finalPhone,
    });

    // VALIDATION
    if (!finalAmount) {
      return res
        .status(400)
        .json({ isSuccess: false, message: "Amount is required" });
    }

    const parsedAmount = parseFloat(finalAmount);
    if (isNaN(parsedAmount) || parsedAmount < 0.1) {
      return res
        .status(400)
        .json({ isSuccess: false, message: "Minimum amount is 0.100 KWD" });
    }

    if (!process.env.MYFATOORAH_API_KEY) {
      return res
        .status(500)
        .json({ isSuccess: false, message: "Payment gateway not configured" });
    }

    // PAYMENT METHOD ID
    const paymentMethodId = finalPaymentMethod === "knet" ? 1 : 2;
    console.log(
      `🎯 ${finalPaymentMethod?.toUpperCase()} - PaymentMethodId: ${paymentMethodId}`
    );

    // EXECUTE PAYMENT
    const executeRes = await axios.post(
      `${process.env.MYFATOORAH_BASE_URL}/v2/ExecutePayment`,
      {
        PaymentMethodId: paymentMethodId,
        InvoiceValue: parsedAmount,
        CustomerName: finalCustomerName,
        CustomerEmail: finalCustomerEmail,
        CustomerMobile: finalPhone,
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
          userId: finalUserId,
          orderData: orderData || req.body,
          paymentMethod: finalPaymentMethod,
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

    if (!executeRes.data.IsSuccess || !executeRes.data.Data?.PaymentURL) {
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
    console.log("📥 SUCCESS CALLBACK:", req.query);
    const { paymentId, invoiceId, PaymentId, InvoiceId } = req.query;

    const id = paymentId || invoiceId || PaymentId || InvoiceId;

    if (!id) {
      return res.redirect(
        `${
          process.env.FRONTEND_URL || "https://lilyandelarosekw.com"
        }/payment-failed?error=no_payment_id`
      );
    }

    res.redirect(
      `${
        process.env.FRONTEND_URL || "https://lilyandelarosekw.com"
      }/payment-success?paymentId=${id}`
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
    // TODO: Process payment confirmation and create order
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
