const axios = require("axios");
const User = require("../models/users.model");

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
        message: `Missing required fields`,
      });
    }

    const amount = parseFloat(amountRaw);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        isSuccess: false,
        message: `Invalid amount: ${amountRaw}`,
      });
    }

    // ✅ 1. ONLY InitiatePayment - NO ExecutePayment!
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

    console.log("✅ Initiate Success:", initiateRes.data.IsSuccess);
    console.log(
      "Available methods:",
      initiateRes.data.Data.PaymentMethods?.length
    );

    if (!initiateRes.data.IsSuccess) {
      throw new Error(`Initiate failed: ${initiateRes.data.Message}`);
    }

    // 🔥 RETURN PAYMENT URL DIRECTLY - Shows SELECTION SCREEN!
    const paymentUrl = initiateRes.data.Data.PaymentUrl;
    if (!paymentUrl) {
      throw new Error("No PaymentUrl received from MyFatoorah");
    }

    console.log("🎯 SELECTION PAGE URL:", paymentUrl);

    res.json({
      isSuccess: true,
      paymentUrl: paymentUrl, // ✅ This shows VISA/KNET/ApplePay selection!
    });
  } catch (error) {
    console.error("💥 ERROR:", error.message);
    res.status(500).json({
      isSuccess: false,
      message: error.message,
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
