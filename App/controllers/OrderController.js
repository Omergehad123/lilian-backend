// controllers/orderController.js - FULL ORDER CONTROLLER WITH SHIPPING COST
const Order = require("../models/order-model");
const User = require("../models/users.model");
const Promo = require("../models/Promo");
const mongoose = require("mongoose");
const asyncWrapper = require("../middleware/asyncWrapper");
const AppError = require("../../utils/appError");
const httpStatusText = require("../../utils/httpStatusText");

const createOrder = asyncWrapper(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 🔥 SUPPORT GUEST USERS
    const userId = req.user?._id || new mongoose.Types.ObjectId();

    const {
      products, subtotal, shippingCost, promoDiscount, totalAmount,
      orderType, scheduleTime, shippingAddress, userInfo, promoCode,
      specialInstructions, paymentMethod
    } = req.body;

    // Validation (keep existing validation code...)
    if (!products || !products.length) {
      throw new AppError("No products provided", 400);
    }

    // Create order with payment tracking
    const order = await Order.create([{
      user: userId,
      products,
      subtotal,
      shippingCost: shippingCost || 0,
      promoCode: promoCode || null,
      promoDiscount: promoDiscount || 0,
      totalAmount,
      orderType,
      scheduleTime,
      shippingAddress,
      userInfo,
      specialInstructions: specialInstructions || null,
      status: "pending",           // Initial status
      isPaid: false,               // Payment pending
      paymentMethod: paymentMethod || null,
    }], { session });

    const createdOrder = order[0];

    await session.commitTransaction();

    // Populate order details
    const populatedOrder = await Order.findById(createdOrder._id)
      .populate("products.product")
      .populate("user", "firstName lastName email");

    res.status(201).json({
      success: true,
      orderId: createdOrder._id.toString(),  // ✅ Frontend needs this
      data: populatedOrder,
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
});


const getOrders = asyncWrapper(async (req, res, next) => {
  const orders = await Order.find({ user: req.user._id })
    .populate("products.product")
    .populate("user", "firstName lastName email")
    .sort({ createdAt: -1 });

  res.json({
    status: httpStatusText.SUCCESS,
    count: orders.length,
    data: orders,
  });
});

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

const getAllOrders = asyncWrapper(async (req, res, next) => {
  const { status, orderType, page = 1, limit = 20 } = req.query;

  const query = {};
  if (status) query.status = status;
  if (orderType) query.orderType = orderType;

  const skip = (page - 1) * limit;
  const orders = await Order.find(query)
    .populate("products.product")
    .populate("user", "firstName lastName email")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Order.countDocuments(query);

  res.json({
    status: httpStatusText.SUCCESS,
    count: orders.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    data: orders,
  });
});

const updateOrderStatus = asyncWrapper(async (req, res, next) => {
  const { status } = req.body;
  const validStatuses = ["pending", "confirmed", "completed", "cancelled"];

  if (!status || !validStatuses.includes(status)) {
    return next(
      new AppError(`Status must be one of: ${validStatuses.join(", ")}`, 400)
    );
  }

  const order = await Order.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true, runValidators: true }
  )
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

const deleteOrder = asyncWrapper(async (req, res, next) => {
  const orderId = req.params.id;

  const order = await Order.findOne({
    _id: orderId,
    user: req.user._id,
  });

  if (!order || order.status !== "pending") {
    return next(new AppError("Cannot delete this order", 400));
  }

  await Order.findByIdAndDelete(orderId);

  res.json({
    status: httpStatusText.SUCCESS,
    message: "Order deleted successfully",
  });
});

const getOrderStats = asyncWrapper(async (req, res, next) => {
  const stats = await Order.aggregate([
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: "$totalAmount" },
        avgOrderValue: { $avg: "$totalAmount" },
        deliveryOrders: {
          $sum: { $cond: [{ $eq: ["$orderType", "delivery"] }, 1, 0] },
        },
        pickupOrders: {
          $sum: { $cond: [{ $eq: ["$orderType", "pickup"] }, 1, 0] },
        },
      },
    },
  ]);

  res.json({
    status: httpStatusText.SUCCESS,
    data: stats[0] || {},
  });
});

module.exports = {
  createOrder,
  getOrders,
  getOrder,
  getAllOrders,
  updateOrderStatus,
  deleteOrder,
  getOrderStats,
};
