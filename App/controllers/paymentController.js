// controllers/paymentController.js
const { MyFatoorah } = require("myfatoorah-toolkit");
const Order = require("../models/order-model"); // Your Order model

// Initialize MyFatoorah (Kuwait Test Mode)
const payment = new MyFatoorah("KWT", true, process.env.MYFATOORAH_API_KEY);

class PaymentController {
  // 🔥 CREATE ORDER + MYFATOORAH PAYMENT
  static async createMyFatoorahPayment(req, res) {
    const session = await Order.startSession();
    session.startTransaction();

    try {
      console.log("🚀 Payment Request from user:", req.user?._id);
      console.log("🚀 Order data:", req.body.orderData);

      const { amount, customerName, customerEmail, phone, orderData } =
        req.body;
      const userId = req.user._id; // From auth middleware

      // ✅ VALIDATE INPUT
      if (!amount || amount <= 0) {
        throw new Error("Invalid amount");
      }
      if (!customerName || !customerEmail || !phone) {
        throw new Error("Missing customer data");
      }

      const cleanPhone = phone.toString().replace(/^\+?965/, "");
      if (cleanPhone.length < 7) {
        throw new Error("Invalid Kuwait phone number");
      }

      // ✅ CREATE ORDER IN DATABASE (status: pending)
      const newOrder = new Order({
        user: userId,
        products: orderData.products || [],
        subtotal: orderData.subtotal || 0,
        shippingCost: orderData.shippingCost || 0,
        totalAmount: amount,
        orderType: orderData.orderType || "pickup",
        promoCode: orderData.promoCode || null,
        promoDiscount: orderData.promoDiscount || 0,
        scheduleTime: orderData.scheduleTime,
        shippingAddress: orderData.shippingAddress,
        userInfo: orderData.userInfo,
        specialInstructions: orderData.specialInstructions || "",
        status: "pending", // Waiting for payment
      });

      const savedOrder = await newOrder.save({ session });
      console.log("✅ Order created:", savedOrder._id);

      // ✅ MYFATOORAH CUSTOMER DATA
      const customerData = {
        CustomerName: customerName.trim(),
        CustomerEmail: customerEmail.trim(),
        MobileCountryCode: "+965",
        CustomerMobile: cleanPhone,
        DisplayCurrencyIso: "KWD",
        CustomerRefNumber: savedOrder._id.toString(), // Link payment to order
      };

      console.log("📤 MyFatoorah request:", customerData);

      // 🔥 CREATE MYFATOORAH PAYMENT
      const result = await payment.executePayment(
        parseFloat(amount) * 1000, // KWD → Halalas
        11, // All payment methods
        customerData
      );

      console.log("📥 MyFatoorah response:", result);

      if (!result.IsSuccess || !result.Data?.PaymentUrl) {
        // Rollback order creation on payment failure
        await session.abortTransaction();
        throw new Error(result.Message || "Payment creation failed");
      }

      // ✅ UPDATE ORDER WITH PAYMENT INFO (still pending payment)
      await Order.findByIdAndUpdate(
        savedOrder._id,
        {
          paymentPending: true,
          myfatoorahInvoiceId: result.Data.InvoiceId,
          myfatoorahPaymentId: result.Data.PaymentId,
        },
        { session }
      );

      await session.commitTransaction();

      // ✅ SUCCESS RESPONSE
      res.json({
        isSuccess: true,
        message: "Order created & payment ready",
        orderId: savedOrder._id,
        paymentUrl: result.Data.PaymentUrl,
        invoiceId: result.Data.InvoiceId,
        paymentId: result.Data.PaymentId,
      });
    } catch (error) {
      await session.abortTransaction();
      console.error("💥 Payment error:", error);

      if (error.message?.includes("API_KEY")) {
        return res.status(500).json({
          isSuccess: false,
          message: "Payment service configuration error",
        });
      }

      res.status(400).json({
        isSuccess: false,
        message: error.message || "Payment setup failed",
      });
    } finally {
      session.endSession();
    }
  }

  // 🔥 WEBHOOK - MyFatoorah notifies payment result
  static async myFatoorahWebhook(req, res) {
    try {
      console.log("📨 Webhook:", req.body);

      const { PaymentId, InvoiceStatus, CustomerRefNumber } = req.body;

      if (!PaymentId || !CustomerRefNumber) {
        return res
          .status(400)
          .json({ message: "Missing PaymentId or OrderId" });
      }

      // ✅ FIND ORDER BY MyFatoorah ORDER ID (CustomerRefNumber)
      const order = await Order.findById(CustomerRefNumber);
      if (!order) {
        console.log("❌ Order not found:", CustomerRefNumber);
        return res.status(200).json({ message: "Order not found" }); // Don't fail webhook
      }

      console.log(
        `✅ Processing webhook for Order ${order._id}: ${InvoiceStatus}`
      );

      // 🔥 PAID - Complete the order!
      if (InvoiceStatus === "PAID") {
        await Order.findByIdAndUpdate(order._id, {
          status: "confirmed",
          paymentStatus: "paid",
          myfatoorahPaymentId: PaymentId,
          myfatoorahInvoiceId: req.body.InvoiceId,
          paidAmount: parseFloat(req.body.InvoiceValue) / 1000,
          paymentCompletedAt: new Date(),
          paymentPending: false,
        });

        console.log(`✅ Order ${order._id} CONFIRMED & PAID`);
      }
      // 🔥 CANCELLED - Mark as cancelled
      else if (InvoiceStatus === "CANCELLED") {
        await Order.findByIdAndUpdate(order._id, {
          status: "cancelled",
          paymentStatus: "cancelled",
          paymentPending: false,
        });
        console.log(`❌ Order ${order._id} CANCELLED`);
      }

      // ✅ MyFatoorah requires 200 OK
      res.status(200).json({ message: "OK" });
    } catch (error) {
      console.error("💥 Webhook error:", error);
      res.status(500).json({ message: "Webhook failed" });
    }
  }

  // 🔥 CHECK PAYMENT STATUS (Frontend polling)
  static async checkPaymentStatus(req, res) {
    try {
      const { invoiceId, paymentId, orderId } = req.query;

      let result;
      if (invoiceId) {
        result = await payment.getPaymentStatus(invoiceId, "InvoiceId");
      } else if (paymentId) {
        result = await payment.getPaymentStatus(paymentId, "PaymentId");
      } else {
        return res.status(400).json({
          isSuccess: false,
          message: "invoiceId, paymentId, or orderId required",
        });
      }

      // ✅ CHECK ORDER STATUS TOO
      let order = null;
      if (orderId) {
        order = await Order.findById(orderId);
      }

      res.json({
        isSuccess: true,
        paymentStatus: result.Data?.InvoiceStatus,
        orderStatus: order?.status || "unknown",
        amount: (result.Data?.InvoiceValue / 1000).toFixed(3),
        orderId: order?._id,
      });
    } catch (error) {
      console.error("Status check error:", error);
      res.status(500).json({
        isSuccess: false,
        message: "Status check failed",
      });
    }
  }
}

module.exports = PaymentController;
