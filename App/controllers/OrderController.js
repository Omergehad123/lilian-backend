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
    const {
      products,
      subtotal,
      shippingCost,
      promoDiscount,
      totalAmount,
      orderType,
      scheduleTime,
      shippingAddress,
      userInfo,
      promoCode,
      specialInstructions,
    } = req.body;

    // Basic validation
    if (!products || !products.length) {
      throw new AppError("No products provided", 400);
    }

    if (!orderType || !["pickup", "delivery"].includes(orderType)) {
      throw new AppError("Invalid order type", 400);
    }

    if (!scheduleTime?.date || !scheduleTime?.timeSlot) {
      throw new AppError("Schedule time is required", 400);
    }

    if (!userInfo?.name || !userInfo?.phone) {
      throw new AppError("User info (name and phone) is required", 400);
    }

    // Validate shipping cost based on order type
    if (orderType === "delivery" && (!shippingCost || shippingCost < 0)) {
      throw new AppError("Shipping cost required for delivery", 400);
    }

    // Validate totals calculation
    const calculatedTotal =
      subtotal + (shippingCost || 0) - (promoDiscount || 0);
    if (Math.abs(totalAmount - calculatedTotal) > 0.01) {
      throw new AppError(
        `Total mismatch. Expected: ${calculatedTotal.toFixed(
          3
        )}, Got: ${totalAmount.toFixed(3)}`,
        400
      );
    }

    // Promo code validation
    if (promoCode && promoDiscount > 0) {
      const promo = await Promo.findOne({
        code: promoCode.toUpperCase(),
        isActive: true,
      }).session(session);

      if (!promo) {
        throw new AppError("Promo code not found or inactive", 400);
      }

      if (promo.expiryDate && new Date(promo.expiryDate) < new Date()) {
        throw new AppError("انتهت صلاحية كود الخصم", 400);
      }

      if (promo.maxUses && promo.currentUses >= promo.maxUses) {
        throw new AppError("تم استهلاك كود الخصم بالكامل", 400);
      }

      // Check if user used this promo before
      const user = await User.findById(req.user._id).session(session);
      const alreadyUsed = user.usedPromoCodes.some(
        (used) => used.promoCode.toUpperCase() === promoCode.toUpperCase()
      );

      if (alreadyUsed) {
        throw new AppError("لقد استخدمت هذا الكود من قبل", 400);
      }

      // Save promo to user
      await User.findByIdAndUpdate(
        req.user._id,
        {
          $push: {
            usedPromoCodes: {
              promoCode: promoCode.toUpperCase(),
              usedAt: new Date(),
              orderId: null,
            },
          },
        },
        { session }
      );

      // Update promo usage
      await Promo.findOneAndUpdate(
        { code: promoCode.toUpperCase() },
        { $inc: { currentUses: 1 } },
        { session }
      );
    }

    // Create order with FULL financial breakdown
    const order = await Order.create(
      [
        {
          user: req.user._id,
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
        },
      ],
      { session }
    );

    const createdOrder = order[0];

    // Update orderId in user's usedPromoCodes
    if (promoCode && promoDiscount > 0) {
      await User.findByIdAndUpdate(
        req.user._id,
        {
          $set: {
            "usedPromoCodes.$[elem].orderId": createdOrder._id,
          },
        },
        {
          arrayFilters: [{ "elem.promoCode": promoCode.toUpperCase() }],
          session,
        }
      );
    }

    await session.commitTransaction();

    // Populate order
    const populatedOrder = await Order.findById(createdOrder._id)
      .populate("products.product")
      .populate("user", "firstName lastName email");

    res.status(201).json({
      status: httpStatusText.SUCCESS,
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
