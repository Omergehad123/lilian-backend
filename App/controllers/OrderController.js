const Order = require("../models/order-model");
const User = require("../models/users.model");
const mongoose = require("mongoose");
const asyncWrapper = require("../middleware/asyncWrapper");
const AppError = require("../../utils/appError");
const httpStatusText = require("../../utils/httpStatusText");

/**
 * CREATE ORDER (guest + logged users)
 * Called ON CHECKOUT (before payment)
 */
const createOrder = asyncWrapper(async (req, res, next) => {
  const {
    products,
    subtotal,
    shippingCost,
    totalAmount,
    orderType,
    scheduleTime,
    shippingAddress,
    promoCode,
    promoDiscount,
    paymentMethod,
    userInfo,
  } = req.body;

  if (!products || products.length === 0) {
    return next(new AppError("Products are required", 400));
  }

  let userId = null;
  let isGuest = true;

  if (req.user) {
    userId = req.user._id;
    isGuest = req.user.isGuest || false;
  }

  const order = await Order.create({
    user: userId,
    isGuest,
    guestInfo: isGuest ? userInfo : null,
    products,
    subtotal,
    shippingCost,
    promoCode,
    promoDiscount,
    totalAmount,
    orderType,
    scheduleTime,
    shippingAddress,
    status: "pending",
    isPaid: false,
    paymentMethod,
  });

  res.status(201).json({
    status: httpStatusText.SUCCESS,
    data: {
      orderId: order._id,
      order,
    },
  });
});

/**
 * PAYMENT SUCCESS (called from payment callback / webhook)
 */
const markOrderAsPaid = asyncWrapper(async (req, res, next) => {
  const { orderId, paymentId, invoiceId } = req.body;

  // 1) Try to find order by orderId first
  let order = null;
  if (orderId) order = await Order.findById(orderId);

  // 2) If not found, try paymentId
  if (!order && paymentId) {
    order = await Order.findOne({ paymentId });
  }

  // 3) If still not found, try invoiceId
  if (!order && invoiceId) {
    order = await Order.findOne({ invoiceId });
  }

  if (!order) {
    return next(new AppError("Order not found", 404));
  }

  // If already paid, skip
  if (order.isPaid) {
    return res.json({
      status: httpStatusText.SUCCESS,
      message: "Order already paid",
      data: order,
    });
  }

  order.isPaid = true;
  order.status = "paid";
  order.paymentId = paymentId || order.paymentId;
  order.invoiceId = invoiceId || order.invoiceId;
  order.paidAt = new Date();

  await order.save();

  res.json({
    status: httpStatusText.SUCCESS,
    data: order,
  });
});

/**
 * USER ORDERS
 */
const getOrders = asyncWrapper(async (req, res) => {
  const orders = await Order.find({ user: req.user._id })
    .populate("products.product")
    .sort({ createdAt: -1 });

  res.json({
    status: httpStatusText.SUCCESS,
    data: orders,
  });
});

/**
 * SINGLE ORDER (success page)
 */
const getOrder = asyncWrapper(async (req, res, next) => {
  const order = await Order.findById(req.params.id)
    .populate("products.product")
    .populate("user", "firstName lastName email");

  if (!order) {
    return next(new AppError("Order not found", 404));
  }

  res.json({
    status: httpStatusText.SUCCESS,
    data: order,
  });
});

/**
 * ADMIN: ALL ORDERS
 */
const getAllOrders = asyncWrapper(async (req, res) => {
  const orders = await Order.find()
    .populate("products.product")
    .populate("user", "firstName lastName email")
    .sort({ createdAt: -1 });

  res.json({
    status: httpStatusText.SUCCESS,
    data: orders,
  });
});

/**
 * GET ORDER BY PAYMENT ID
 */
const getOrderByPaymentId = asyncWrapper(async (req, res, next) => {
  const { paymentId } = req.params;

  const order = await Order.findOne({ paymentId })
    .populate("products.product")
    .populate("user", "firstName lastName email");

  if (!order) {
    return next(new AppError("Order not found", 404));
  }

  res.status(200).json({
    status: httpStatusText.SUCCESS,
    data: order,
  });
});

/**
 * GET ORDER BY INVOICE ID
 */
const getOrderByInvoiceId = asyncWrapper(async (req, res, next) => {
  const { invoiceId } = req.params;

  const order = await Order.findOne({ invoiceId })
    .populate("products.product")
    .populate("user", "firstName lastName email");

  if (!order) {
    return next(new AppError("Order not found", 404));
  }

  res.status(200).json({
    status: httpStatusText.SUCCESS,
    data: order,
  });
});

module.exports = {
  createOrder,
  markOrderAsPaid,
  getOrders,
  getOrder,
  getAllOrders,
  getOrderByPaymentId,
  getOrderByInvoiceId,
};
