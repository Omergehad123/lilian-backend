// App/controllers/paymentController.js - الكود الكامل
const axios = require("axios");
const User = require("../models/users.model");

exports.createMyFatoorahPayment = async (req, res) => {
  try {
    console.log("📥 MyFatoorah Request:", req.body);

    const { amount, customerName, customerEmail, userId } = req.body;

    if (!amount || !customerName || !customerEmail || !userId) {
      console.log("❌ Missing:", {
        amount,
        customerName,
        customerEmail,
        userId,
      });
      return res.status(400).json({
        isSuccess: false,
        message: "Missing required fields",
      });
    }

    const invoiceAmount = parseFloat(amount);
    console.log(`✅ Payment: ${invoiceAmount} KWD`);

    // Initiate
    const initiateRes = await axios.post(
      `${process.env.MYFATOORAH_BASE_URL}/v2/InitiatePayment`,
      { InvoiceAmount: invoiceAmount, CurrencyIso: "KWD" },
      {
        headers: {
          Authorization: `Bearer ${process.env.MYFATOORAH_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const paymentMethodId =
      initiateRes.data.Data.PaymentMethods[0].PaymentMethodId;

    // Execute
    const executeRes = await axios.post(
      `${process.env.MYFATOORAH_BASE_URL}/v2/ExecutePayment`,
      {
        PaymentMethodId: paymentMethodId,
        InvoiceValue: invoiceAmount,
        CustomerName: customerName,
        CustomerEmail: customerEmail,
        CallBackUrl: `${process.env.FRONTEND_URL}/payment-success`,
        ErrorUrl: `${process.env.FRONTEND_URL}/payment-failed`,
        NotificationOption: "ALL",
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.MYFATOORAH_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(
      "✅ Payment URL:",
      executeRes.data.Data.PaymentURL ? "OK" : "FAILED"
    );

    res.json({
      isSuccess: true,
      paymentUrl: executeRes.data.Data.PaymentURL,
    });
  } catch (error) {
    console.error("❌ Error:", error.response?.data || error.message);
    res.status(500).json({
      isSuccess: false,
      message: error.response?.data?.Message || "Payment failed",
    });
  }
};

exports.handlePaymentSuccess = async (req, res) => {
  try {
    console.log("📥 Success callback:", req.query);
    const { userId, paymentId } = req.query;

    const user = await User.findById(userId);
    if (!user)
      return res.redirect(`${process.env.FRONTEND_URL}/payment-failed`);

    user.orders.push({
      paymentId,
      status: "paid",
      items: [],
      totalAmount: 0,
      orderType: "delivery",
      scheduleTime: new Date(),
    });
    user.cart = [];
    await user.save();

    res.redirect(
      `${process.env.FRONTEND_URL}/payment-success?paymentId=${paymentId}`
    );
  } catch (err) {
    console.error("❌ Success error:", err);
    res.redirect(`${process.env.FRONTEND_URL}/payment-failed`);
  }
};
