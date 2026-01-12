const { MyFatoorah } = require("myfatoorah-toolkit");
const Order = require("../models/order-model");

const payment = new MyFatoorah("KWT", true, process.env.MYFATOORAH_API_KEY);

class PaymentController {
  // 1. CREATE PAYMENT URL
  static async createMyFatoorahPayment(req, res) {
    try {
      const { amount, customerName, customerEmail, phone, userId, orderData } =
        req.body;

      if (!amount || amount <= 0) {
        return res
          .status(400)
          .json({ isSuccess: false, message: "Invalid amount" });
      }

      // Create pending order FIRST
      const order = new Order({
        user: userId,
        ...orderData,
        status: "pending",
        paymentStatus: "pending",
        paymentGateway: "myfatoorah",
      });
      await order.save();

      // Execute payment with ALL methods (ID: 11)
      const paymentData = {
        CustomerName: customerName,
        CustomerEmail: customerEmail,
        MobileCountryCode: "+965",
        CustomerMobile: phone.replace("+965", ""),
        DisplayCurrencyIso: "KWD",
      };

      const result = await payment.executePayment(
        parseFloat(amount) * 1000, // Convert KWD to Halalas
        11, // ALL payment methods
        paymentData
      );

      if (result.IsSuccess && result.Data.PaymentUrl) {
        // Save payment details
        order.paymentUrl = result.Data.PaymentUrl;
        order.paymentId = result.Data.InvoiceId;
        order.customerReference = result.Data.CustomerReference;
        await order.save();

        return res.json({
          isSuccess: true,
          paymentUrl: result.Data.PaymentUrl,
          orderId: order._id,
          invoiceId: result.Data.InvoiceId,
        });
      }

      return res.status(400).json({
        isSuccess: false,
        message: result.Message || "Payment failed",
        errors: result.ValidationErrors,
      });
    } catch (error) {
      console.error("Payment Error:", error);
      res.status(500).json({
        isSuccess: false,
        message: "Payment initialization failed",
      });
    }
  }

  static async myFatoorahWebhook(req, res) {
    try {
      const { validateSignature } = require("myfatoorah-toolkit");

      const signature = req.get("MyFatoorah-Signature");
      const isValid = await validateSignature(
        req.body,
        signature,
        process.env.MYFATOORAH_SECRET_KEY || ""
      );

      if (!isValid) {
        console.log("❌ Invalid webhook signature");
        return res.status(401).json({ message: "Invalid signature" });
      }

      const { PaymentId, InvoiceStatus, CustomerReference } = req.body;

      // Find order
      const order = await Order.findById(CustomerReference || orderId);
      if (!order) {
        console.log("❌ Order not found:", CustomerReference);
        return res.status(404).json({ message: "Order not found" });
      }

      // Update on success
      if (InvoiceStatus === "PAID") {
        order.status = "confirmed";
        order.paymentStatus = "paid";
        order.paymentId = PaymentId;
        await order.save();

        console.log(`✅ Order ${order._id} PAID! Amount: ${order.totalAmount}`);

        // Clear customer cart here if needed
      }

      res.status(200).json({ message: "OK" });
    } catch (error) {
      console.error("Webhook Error:", error);
      res.status(500).json({ message: "Webhook failed" });
    }
  }

  // 3. CHECK STATUS
  static async checkPaymentStatus(req, res) {
    try {
      const { orderId } = req.params;
      const order = await Order.findById(orderId);

      res.json({
        isSuccess: true,
        paymentStatus: order?.paymentStatus,
        orderStatus: order?.status,
      });
    } catch (error) {
      res
        .status(500)
        .json({ isSuccess: false, message: "Status check failed" });
    }
  }
}

module.exports = PaymentController;
