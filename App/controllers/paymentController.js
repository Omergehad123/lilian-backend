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
      console.error("❌ MYFATOORAH_API_KEY missing in .env");
      return res
        .status(500)
        .json({ isSuccess: false, message: "Payment gateway not configured" });
    }

    // 1. INITIATE PAYMENT with method selection
    const initiatePayload = {
      InvoiceAmount: amount,
      CurrencyIso: "KWD",
      Language: "en",
    };

    // ✅ FORCE SPECIFIC PAYMENT METHOD based on selection
    if (paymentMethod === "knet") {
      initiatePayload.PaymentMethodId = 1; // KNET
      console.log("🎯 Forced KNET payment method");
    } else if (paymentMethod === "card") {
      initiatePayload.PaymentMethodId = 2; // Credit Card
      console.log("🎯 Forced CARD payment method");
    }

    const initiateRes = await axios.post(
      `${process.env.MYFATOORAH_BASE_URL}/v2/InitiatePayment`,
      initiatePayload,
      {
        headers: {
          Authorization: `Bearer ${process.env.MYFATOORAH_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    console.log("✅ Initiate Response:", {
      success: initiateRes.data.IsSuccess,
      invoiceId: initiateRes.data.Data?.InvoiceId,
      paymentMethods: initiateRes.data.Data?.PaymentMethods?.length || 0,
      hasPaymentUrl: !!initiateRes.data.Data?.PaymentUrl,
    });

    if (!initiateRes.data.IsSuccess) {
      console.error("❌ Initiate failed:", initiateRes.data.Message);
      return res.status(400).json({
        isSuccess: false,
        message: initiateRes.data.Message || "Failed to initiate payment",
      });
    }

    let paymentUrl = initiateRes.data.Data.PaymentUrl;

    // 2. IF NO DIRECT URL, EXECUTE PAYMENT
    if (!paymentUrl && initiateRes.data.Data.PaymentMethods?.length > 0) {
      console.log("🔄 No direct PaymentUrl, executing payment...");

      const targetMethod =
        paymentMethod === "knet"
          ? initiateRes.data.Data.PaymentMethods.find((m) =>
              m.PaymentMethodName?.toLowerCase().includes("knet")
            )
          : initiateRes.data.Data.PaymentMethods.find(
              (m) =>
                m.PaymentMethodName?.toLowerCase().includes("card") ||
                m.PaymentMethodName?.toLowerCase().includes("visa") ||
                m.PaymentMethodName?.toLowerCase().includes("master")
            ) || initiateRes.data.Data.PaymentMethods[0];

      console.log(
        "🎯 Using payment method:",
        targetMethod.PaymentMethodName,
        targetMethod.PaymentMethodId
      );

      const executeRes = await axios.post(
        `${process.env.MYFATOORAH_BASE_URL}/v2/ExecutePayment`,
        {
          PaymentMethodId: targetMethod.PaymentMethodId,
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
          Lang: language || "en",
          DisplayCurrencyIso: "KWD",
          UserDefinedField: JSON.stringify({
            userId,
            orderData: req.body.orderData || req.body,
            invoiceId: initiateRes.data.Data.InvoiceId,
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

      if (!executeRes.data.IsSuccess || !executeRes.data.Data.PaymentURL) {
        console.error("❌ Execute failed:", executeRes.data);
        return res.status(400).json({
          isSuccess: false,
          message: executeRes.data.Message || "Payment execution failed",
        });
      }

      paymentUrl = executeRes.data.Data.PaymentURL;
      console.log("✅ Execute PaymentURL:", paymentUrl);
    }

    if (!paymentUrl) {
      console.error("❌ NO PAYMENT URL FOUND");
      return res.status(400).json({
        isSuccess: false,
        message: "Payment URL not available. Please contact support.",
      });
    }

    console.log("🎉 SUCCESS! Redirecting to:", paymentUrl);
    res.json({
      isSuccess: true,
      paymentUrl: paymentUrl,
      invoiceId: initiateRes.data.Data.InvoiceId,
    });
  } catch (error) {
    console.error("💥 FULL ERROR:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      url: error.config?.url,
      stack: error.stack,
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

// ✅ PAYMENT SUCCESS CALLBACK
const handlePaymentSuccess = async (req, res) => {
  try {
    console.log("📥 SUCCESS CALLBACK:", req.query, req.body);

    const { paymentId, invoiceId } = req.query;
    if (!paymentId && !invoiceId) {
      return res.redirect(
        `${
          process.env.FRONTEND_URL || "https://lilyandelarosekw.com"
        }/payment-failed?error=no_payment_id`
      );
    }

    // Verify payment status
    if (process.env.MYFATOORAH_API_KEY) {
      const statusRes = await axios.get(
        `${process.env.MYFATOORAH_BASE_URL}/v2/getPaymentStatus?key=${
          paymentId || invoiceId
        }&keyType=PaymentId`,
        {
          headers: {
            Authorization: `Bearer ${process.env.MYFATOORAH_API_KEY}`,
          },
          timeout: 10000,
        }
      );

      if (
        !statusRes.data.IsSuccess ||
        statusRes.data.Data.PaymentStatus !== "Paid"
      ) {
        console.error("❌ Payment not confirmed:", statusRes.data);
        return res.redirect(
          `${
            process.env.FRONTEND_URL || "https://lilyandelarosekw.com"
          }/payment-failed?error=not_paid`
        );
      }

      console.log(
        "✅ Payment verified:",
        statusRes.data.Data.PaymentId,
        statusRes.data.Data.PaymentStatus
      );
    }

    // Parse order data
    let orderData = {};
    const userDefinedField = req.query.UserDefinedField;
    if (userDefinedField) {
      try {
        orderData = JSON.parse(decodeURIComponent(userDefinedField));
      } catch (e) {
        console.error("Failed to parse order data:", e);
      }
    }

    // Save to user orders (if logged in)
    const userId = orderData.userId || req.user?._id;
    if (userId && userId !== "guest") {
      await User.findByIdAndUpdate(userId, {
        $push: {
          orders: {
            paymentId: paymentId || invoiceId,
            status: "paid",
            totalAmount: orderData.orderData?.totalAmount || amount,
            orderData: orderData.orderData || null,
          },
        },
      });
      console.log("✅ Order saved to user:", userId);
    }

    console.log("🎉 PAYMENT SUCCESS! Redirecting...");
    res.redirect(
      `${
        process.env.FRONTEND_URL || "https://lilyandelarosekw.com"
      }/payment-success?paymentId=${paymentId || invoiceId}&userId=${userId}`
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

// ✅ WEBHOOK HANDLER
const handleWebhook = async (req, res) => {
  try {
    console.log("🔔 WEBHOOK RECEIVED:", req.body);

    const { PaymentId, InvoiceId, PaymentStatus } = req.body.Data || {};

    if (PaymentStatus === "Paid") {
      // Verify payment
      const statusRes = await axios.get(
        `${process.env.MYFATOORAH_BASE_URL}/v2/getPaymentStatus?key=${PaymentId}&keyType=PaymentId`,
        {
          headers: {
            Authorization: `Bearer ${process.env.MYFATOORAH_API_KEY}`,
          },
        }
      );

      if (statusRes.data.Data.PaymentStatus === "Paid") {
        const userDefinedField = statusRes.data.Data.UserDefinedField;
        const orderData = userDefinedField ? JSON.parse(userDefinedField) : {};

        console.log("✅ WEBHOOK: Payment confirmed", PaymentId);
        // TODO: Create order in your database here
      }
    }

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
