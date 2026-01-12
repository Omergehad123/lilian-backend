const axios = require("axios");
const User = require("../models/users.model");

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

    // 1. INITIATE PAYMENT - GET ALL METHODS
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
    console.log(
      "Available methods:",
      initiateRes.data.Data.PaymentMethods?.map((m) => m.PaymentMethodName)
    );

    if (!initiateRes.data.IsSuccess) {
      throw new Error(`Initiate failed: ${initiateRes.data.Message}`);
    }

    // ✅ CHECK 1: Direct PaymentUrl (shows selection screen)
    if (initiateRes.data.Data.PaymentUrl) {
      console.log(
        "✅ DIRECT PaymentUrl (selection screen):",
        initiateRes.data.Data.PaymentUrl
      );
      return res.json({
        isSuccess: true,
        paymentUrl: initiateRes.data.Data.PaymentUrl,
      });
    }

    // ✅ CHECK 2: Find CARD payment method (VISA/Mastercard)
    const cardMethods = initiateRes.data.Data.PaymentMethods?.filter(
      (method) =>
        method.PaymentMethodName?.toLowerCase().includes("card") ||
        method.PaymentMethodName?.toLowerCase().includes("visa") ||
        method.PaymentMethodName?.toLowerCase().includes("master") ||
        method.PaymentMethodId === 2 || // Common card ID
        method.PaymentMethodEntry === 2 // Card entry point
    );

    let paymentUrl;

    if (cardMethods && cardMethods.length > 0) {
      // ✅ PRIORITY: Execute with CARD method (direct to card form)
      const cardMethodId = cardMethods[0].PaymentMethodId;
      console.log(
        "🎴 Using CARD method:",
        cardMethods[0].PaymentMethodName,
        cardMethodId
      );

      const executeRes = await axios.post(
        `${process.env.MYFATOORAH_BASE_URL}/v2/ExecutePayment`,
        {
          PaymentMethodId: cardMethodId,
          InvoiceValue: amount,
          CustomerName: customerName,
          CustomerEmail: customerEmail,
          CustomerMobile: phone || "96500000000",
          CallBackUrl: `${
            process.env.FRONTEND_URL || "http://localhost:3000"
          }/payment-success`,
          ErrorUrl: `${
            process.env.FRONTEND_URL || "http://localhost:3000"
          }/payment-failed`,
          NotificationOption: "ALL",
          Lang: "en", // Shows English selection
          DisplayCurrencyIso: "KWD",
          UserDefinedField: JSON.stringify({
            userId,
            orderData: req.body.orderData || req.body,
            invoiceId: initiateRes.data.Data.InvoiceId,
          }),
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.MYFATOORAH_API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );

      if (!executeRes.data.IsSuccess || !executeRes.data.Data.PaymentURL) {
        console.error("❌ Execute failed:", executeRes.data);
        throw new Error(`Execute failed: ${executeRes.data.Message}`);
      }

      paymentUrl = executeRes.data.Data.PaymentURL;
      console.log("✅ CARD PaymentURL:", paymentUrl);
    } else {
      // ✅ FALLBACK: Use first available method (will show KNET but logs it)
      const firstMethod = initiateRes.data.Data.PaymentMethods[0];
      console.log(
        "⚠️  No card methods, using first:",
        firstMethod?.PaymentMethodName
      );

      const executeRes = await axios.post(
        `${process.env.MYFATOORAH_BASE_URL}/v2/ExecutePayment`,
        {
          PaymentMethodId: firstMethod.PaymentMethodId,
          InvoiceValue: amount,
          CustomerName: customerName,
          CustomerEmail: customerEmail,
          CustomerMobile: phone || "96500000000",
          CallBackUrl: `${
            process.env.FRONTEND_URL || "http://localhost:3000"
          }/payment-success`,
          ErrorUrl: `${
            process.env.FRONTEND_URL || "http://localhost:3000"
          }/payment-failed`,
          NotificationOption: "ALL",
          Lang: "en",
          UserDefinedField: JSON.stringify({
            userId,
            orderData: req.body.orderData || req.body,
            invoiceId: initiateRes.data.Data.InvoiceId,
          }),
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.MYFATOORAH_API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );

      paymentUrl = executeRes.data.Data.PaymentURL;
    }

    res.json({
      isSuccess: true,
      paymentUrl: paymentUrl,
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

// 2. HANDLE PAYMENT SUCCESS CALLBACK
const handlePaymentSuccess = async (req, res) => {
  try {
    console.log("📥 Success callback:", req.query, req.body);

    const { paymentId, userId, invoiceId } = req.query;

    if (!paymentId && !invoiceId) {
      return res.redirect(
        `${
          process.env.FRONTEND_URL || "http://localhost:3000"
        }/payment-failed?error=no_payment_id`
      );
    }

    // Verify payment status with MyFatoorah
    if (process.env.MYFATOORAH_API_KEY) {
      const statusRes = await axios.get(
        `${process.env.MYFATOORAH_BASE_URL}/v2/getPaymentStatus?key=${
          paymentId || invoiceId
        }&keyType=PaymentId`,
        {
          headers: {
            Authorization: `Bearer ${process.env.MYFATOORAH_API_KEY}`,
          },
          timeout: 5000,
        }
      );

      if (
        !statusRes.data.IsSuccess ||
        statusRes.data.Data.PaymentStatus !== "Paid"
      ) {
        console.error("❌ Payment not confirmed:", statusRes.data);
        return res.redirect(
          `${
            process.env.FRONTEND_URL || "http://localhost:3000"
          }/payment-failed?error=not_paid`
        );
      }
    }

    // Store order data from UserDefinedField
    const userDefinedField = req.query.UserDefinedField;
    let orderData = {};
    if (userDefinedField) {
      try {
        orderData = JSON.parse(decodeURIComponent(userDefinedField));
      } catch (e) {
        console.error("Failed to parse order data");
      }
    }

    // Save order to user
    if (userId) {
      await User.findByIdAndUpdate(userId, {
        $push: {
          orders: {
            paymentId: paymentId || invoiceId,
            status: "paid",
            totalAmount: orderData.orderData?.totalAmount || 0,
            orderData: orderData.orderData || null,
          },
        },
      });
    }

    console.log("✅ Payment success saved");
    res.redirect(
      `${
        process.env.FRONTEND_URL || "http://localhost:3000"
      }/payment-success?paymentId=${paymentId || invoiceId}&userId=${userId}`
    );
  } catch (error) {
    console.error("❌ Success handler error:", error);
    res.redirect(
      `${
        process.env.FRONTEND_URL || "http://localhost:3000"
      }/payment-failed?error=server_error`
    );
  }
};

// 3. WEBHOOK HANDLER
const handleWebhook = async (req, res) => {
  try {
    console.log("🔔 WEBHOOK received:", req.body);

    const { PaymentId, InvoiceId, PaymentStatus } = req.body.Data;

    if (PaymentStatus === "Paid") {
      const statusRes = await axios.get(
        `${process.env.MYFATOORAH_BASE_URL}/v2/getPaymentStatus?key=${PaymentId}&keyType=PaymentId`,
        {
          headers: {
            Authorization: `Bearer ${process.env.MYFATOORAH_API_KEY}`,
          },
        }
      );

      const userDefinedField = statusRes.data.Data.UserDefinedField;
      const orderData = userDefinedField ? JSON.parse(userDefinedField) : {};

      console.log("✅ Webhook: Order created for PaymentId", PaymentId);
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
