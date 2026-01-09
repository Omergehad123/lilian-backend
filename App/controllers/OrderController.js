const Order = require("../models/order-model");
const asyncWrapper = require("../middleware/asyncWrapper");
const AppError = require("../../utils/appError");
const httpStatusText = require("../../utils/httpStatusText");

const createOrder = asyncWrapper(async (req, res, next) => {
  const {
    products,
    totalAmount,
    orderType,
    scheduleTime,
    shippingAddress,
    userInfo,
  } = req.body;

  if (!products || !products.length) {
    return next(new AppError("No products provided", 400));
  }

  if (!orderType || !["pickup", "delivery"].includes(orderType)) {
    return next(new AppError("Invalid order type", 400));
  }

  if (!scheduleTime?.date || !scheduleTime?.timeSlot) {
    return next(new AppError("Schedule time is required", 400));
  }

  if (!userInfo?.name || !userInfo?.phone) {
    return next(new AppError("User info (name and phone) is required", 400));
  }

  const order = await Order.create({
    user: req.user._id,
    products,
    totalAmount,
    orderType,
    scheduleTime,
    shippingAddress,
    userInfo,
  });

  res.status(201).json({
    status: httpStatusText.SUCCESS,
    data: order,
  });
});

// @desc    Get all orders of logged-in user
// @route   GET /api/orders
// @access  Private
const getOrders = asyncWrapper(async (req, res, next) => {
  const orders = await Order.find({ user: req.user._id }).populate(
    "products.product"
  );

  res.json({
    status: httpStatusText.SUCCESS,
    count: orders.length,
    data: orders,
  });
});

// Optional: get a single order by ID
const getOrder = asyncWrapper(async (req, res, next) => {
  const order = await Order.findById(req.params.id).populate(
    "products.product"
  );

  if (!order) {
    return next(new AppError("Order not found", 404));
  }

  res.json({
    status: httpStatusText.SUCCESS,
    data: order,
  });
});

// @desc    Get all orders (Admin/Manager only)
// @route   GET /api/orders/admin/all
// @access  Private (Admin/Manager)
const getAllOrders = asyncWrapper(async (req, res, next) => {
  const orders = await Order.find()
    .populate("products.product")
    .populate("user", "firstName lastName email")
    .sort({ createdAt: -1 });

  res.json({
    status: httpStatusText.SUCCESS,
    count: orders.length,
    data: orders,
  });
});

// @desc    Update order status
// @route   PATCH /api/orders/:id/status
// @access  Private (Admin/Manager)
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
    user: req.user._id, // ✅ Matches createOrder field
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

module.exports = {
  createOrder,
  getOrders,
  getOrder,
  getAllOrders,
  updateOrderStatus,
  deleteOrder,
};
