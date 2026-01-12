const axios = require("axios");
const User = require("../models/users.model");

const createMyFatoorahPayment = async (req, res) => {
  try {
    console.log("📥 FULL REQUEST:", JSON.stringify(req.body, null, 2));

    // Extract data safely
    const amount = parseFloat(
      req.body.amount || req.body.orderData?.totalAmount
    );
    const customerName =
      req.body.customerName || req.body.orderData?.userInfo?.name || "Guest";
    const customerEmail = req.body.customerEmail || "customer@lilian.com";
    const phone =
      req.body.phone || req.body.orderData?.userInfo?.phone || "96500000000";
    const userId = req.body.userId || "guest";

    if (!amount || amount <= 0) {
      return res
        .status(400)
        .json({ isSuccess: false, message: "Invalid amount" });
    }

    console.log(`✅ Processing ${amount} KWD for ${customerName}`);

    // 1. Initiate Payment
    const initiateRes = await axios.post(
      `${process.env.MYFATOORAH_BASE_URL}/v2/InitiatePayment`,
      {
        InvoiceAmount: amount,
        CurrencyIso: "KWD",
        Language: "en",
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.MYFATOORAH_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    console.log("✅ Initiate response:", {
      IsSuccess: initiateRes.data.IsSuccess,
      hasPaymentUrl: !!initiateRes.data.Data?.PaymentUrl,
      hasPaymentMethods: !!initiateRes.data.Data?.PaymentMethods?.length,
      invoiceId: initiateRes.data.Data?.InvoiceId,
    });

    if (!initiateRes.data.IsSuccess) {
      console.error("❌ Initiate failed:", initiateRes.data.Message);
      return res.status(400).json({
        isSuccess: false,
        message: initiateRes.data.Message || "Initiate payment failed",
      });
    }

    // 🔥 TRY 3 WAYS TO GET PAYMENT URL:

    // WAY 1: Direct PaymentUrl (selection page)
    let paymentUrl = initiateRes.data.Data.PaymentUrl;

    // WAY 2: If no direct URL, use SendPayment for invoice link
    if (!paymentUrl) {
      console.log("🔄 No PaymentUrl, trying SendPayment...");
      const sendRes = await axios.post(
        `${process.env.MYFATOORAH_BASE_URL}/v2/SendPayment`,
        {
          InvoiceValue: amount,
          CustomerName: customerName,
          CustomerEmail: customerEmail,
          CustomerMobile: phone,
          DisplayCurrencyIso: "KWD",
          MobileCountryCode: "965",
          NotificationOption: "LNK",
          UserDefinedField: JSON.stringify({
            userId,
            orderData: req.body.orderData,
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

      if (sendRes.data.IsSuccess) {
        paymentUrl = sendRes.data.Data.PaymentUrl;
        console.log("✅ SendPayment URL:", paymentUrl);
      }
    }

    // WAY 3: Fallback - Execute first payment method (selection via gateway)
    if (!paymentUrl && initiateRes.data.Data.PaymentMethods?.length > 0) {
      console.log("🔄 Fallback ExecutePayment...");
      const firstMethod = initiateRes.data.Data.PaymentMethods[0];

      const executeRes = await axios.post(
        `${process.env.MYFATOORAH_BASE_URL}/v2/ExecutePayment`,
        {
          PaymentMethodId: firstMethod.PaymentMethodId,
          InvoiceValue: amount,
          CustomerName: customerName,
          CustomerEmail: customerEmail,
          CustomerMobile: phone,
          CallBackUrl: `${process.env.FRONTEND_URL}/payment-success`,
          ErrorUrl: `${process.env.FRONTEND_URL}/payment-failed`,
          NotificationOption: "ALL",
          UserDefinedField: JSON.stringify({
            userId,
            orderData: req.body.orderData,
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

      if (executeRes.data.IsSuccess) {
        paymentUrl = executeRes.data.Data.PaymentURL;
        console.log("✅ ExecutePayment URL:", paymentUrl);
      }
    }

    if (!paymentUrl) {
      console.error("❌ NO URL FOUND:", initiateRes.data.Data);
      return res.status(400).json({
        isSuccess: false,
        message:
          "No payment URL available. Check MyFatoorah dashboard settings.",
      });
    }

    console.log("🎉 FINAL PAYMENT URL:", paymentUrl);
    res.json({
      isSuccess: true,
      paymentUrl: paymentUrl,
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
