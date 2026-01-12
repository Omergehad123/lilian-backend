// controllers/paymentController.js
const { MyFatoorah } = require("myfatoorah-toolkit");
const Order = require("../models/order-model");

const payment = new MyFatoorah("KWT", true, process.env.MYFATOORAH_API_KEY);

class PaymentController {
  static async createMyFatoorahPayment(req, res) {
    try {
      console.log("🚀 Payment Request:", req.body);
      console.log("🚀 User:", req.user?._id);

      const { amount, customerName, customerEmail, phone, orderData } =
        req.body;
      const userId = req.user._id; // From verifyCookieToken

      // ✅ VALIDATE
      if (!amount || amount <= 0) {
        return res
          .status(400)
          .json({ isSuccess: false, message: "Invalid amount" });
      }
      if (!customerName || !customerEmail || !phone) {
        return res
          .status(400)
          .json({ isSuccess: false, message: "Missing customer data" });
      }

      const cleanPhone = phone.toString().replace(/^\+?965/, "");
      if (cleanPhone.length < 7) {
        return res
          .status(400)
          .json({ isSuccess: false, message: "Invalid Kuwait phone" });
      }

      // ✅ CREATE ORDER FIRST (status: pending)
      const newOrder = new Order({
        user: userId,
        products: orderData.products,
        subtotal: orderData.subtotal || 0,
        shippingCost: orderData.shippingCost || 0,
        totalAmount: amount,
        orderType: orderData.orderType,
        promoCode: orderData.promoCode || null,
        promoDiscount: orderData.promoDiscount || 0,
        scheduleTime: orderData.scheduleTime,
        shippingAddress: orderData.shippingAddress,
        userInfo: orderData.userInfo,
        specialInstructions: orderData.specialInstructions || "",
        status: "pending",
        paymentStatus: "pending",
        paymentPending: true,
      });

      const savedOrder = await newOrder.save();
      console.log("✅ Order saved:", savedOrder._id);

      // ✅ MYFATOORAH PAYMENT
      const customerData = {
        CustomerName: customerName.trim(),
        CustomerEmail: customerEmail.trim(),
        MobileCountryCode: "+965",
        CustomerMobile: cleanPhone,
        DisplayCurrencyIso: "KWD",
        CustomerRefNumber: savedOrder._id.toString(), // Links to order
      };

      const result = await payment.executePayment(
        parseFloat(amount) * 1000, // KWD → Halalas
        11, // All methods
        customerData
      );

      if (!result.IsSuccess || !result.Data?.PaymentUrl) {
        // ❌ DELETE FAILED ORDER
        await Order.findByIdAndDelete(savedOrder._id);
        return res.status(400).json({
          isSuccess: false,
          message: result.Message || "Payment creation failed",
        });
      }

      // ✅ UPDATE ORDER WITH PAYMENT INFO
      await Order.findByIdAndUpdate(savedOrder._id, {
        myfatoorahInvoiceId: result.Data.InvoiceId,
        myfatoorahPaymentId: result.Data.PaymentId,
        paymentPending: true,
      });

      res.json({
        isSuccess: true,
        message: "Payment ready",
        orderId: savedOrder._id,
        paymentUrl: result.Data.PaymentUrl,
        invoiceId: result.Data.InvoiceId,
        paymentId: result.Data.PaymentId,
      });
    } catch (error) {
      console.error("💥 Payment error:", error);

      if (error.message?.includes("API_KEY")) {
        return res.status(500).json({
          isSuccess: false,
          message: "Payment service error",
        });
      }

      res.status(500).json({
        isSuccess: false,
        message: error.message || "Server error",
      });
    }
  }

  // 🔥 WEBHOOK (unchanged)
  static async myFatoorahWebhook(req, res) {
    try {
      const { PaymentId, InvoiceStatus, CustomerRefNumber } = req.body;

      if (!PaymentId || !CustomerRefNumber) {
        return res.status(400).json({ message: "Missing data" });
      }

      const order = await Order.findById(CustomerRefNumber);
      if (!order) {
        return res.status(200).json({ message: "Order not found" });
      }

      if (InvoiceStatus === "PAID") {
        await Order.findByIdAndUpdate(order._id, {
          status: "confirmed",
          paymentStatus: "paid",
          paidAmount: parseFloat(req.body.InvoiceValue) / 1000,
          paymentCompletedAt: new Date(),
          paymentPending: false,
        });
        console.log(`✅ Order ${order._id} PAID`);
      } else if (InvoiceStatus === "CANCELLED") {
        await Order.findByIdAndUpdate(order._id, {
          status: "cancelled",
          paymentStatus: "cancelled",
          paymentPending: false,
        });
      }

      res.status(200).json({ message: "OK" });
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(500).json({ message: "Failed" });
    }
  }

  static async checkPaymentStatus(req, res) {
    try {
      const { invoiceId, paymentId, orderId } = req.query;

      // Simplified - just return order status
      const order = await Order.findById(orderId);
      if (order) {
        return res.json({
          isSuccess: true,
          orderStatus: order.status,
          paymentStatus: order.paymentStatus,
          orderId: order._id,
        });
      }

      res.status(404).json({ isSuccess: false, message: "Order not found" });
    } catch (error) {
      res.status(500).json({ isSuccess: false, message: "Error" });
    }
  }
}

module.exports = PaymentController;
