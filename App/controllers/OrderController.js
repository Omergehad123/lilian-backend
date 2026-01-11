const Order = require("../models/order-model");
const User = require("../models/users.model");
const Promo = require("../models/Promo");
const mongoose = require("mongoose");
const asyncWrapper = require("../middleware/asyncWrapper");
const AppError = require("../../utils/appError");
const httpStatusText = require("../../utils/httpStatusText");

// ✅ CONFIG - Admin start time (CHANGE THIS to admin's preferred time)
const ADMIN_START_TIME = "19:00"; // 7 PM - Format: "HH:MM"

const createOrder = asyncWrapper(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      products,
      totalAmount,
      orderType,
      scheduleTime,
      shippingAddress,
      userInfo,
      promoCode,
      promoDiscount,
      specialInstructions,
      subtotal,
      discountedSubtotal,
      shippingCost,
    } = req.body;

    // ✅ Validation
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

    // ✅ Promo validation (your existing logic)
    if (promoCode && promoDiscount > 0) {
      const promo = await Promo.findOne({
        code: promoCode.toUpperCase(),
        isActive: true,
      });

      if (!promo) {
        throw new AppError("Promo code not found or inactive", 400);
      }

      if (promo.expiryDate && new Date(promo.expiryDate) < new Date()) {
        throw new AppError("انتهت صلاحية كود الخصم", 400);
      }

      if (promo.maxUses && promo.currentUses >= promo.maxUses) {
        throw new AppError("تم استهلاك كود الخصم بالكامل", 400);
      }

      const user = await User.findById(req.user._id);
      const alreadyUsed = user.usedPromoCodes.some(
        (used) => used.promoCode.toUpperCase() === promoCode.toUpperCase()
      );

      if (alreadyUsed) {
        throw new AppError("لقد استخدمت هذا الكود من قبل", 400);
      }

      // Save promo usage
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

      await Promo.findOneAndUpdate(
        { code: promoCode.toUpperCase() },
        { $inc: { currentUses: 1 } },
        { session }
      );
    }

    // ✅ CREATE ORDER with delayed notification fields
    const order = await Order.create(
      [
        {
          user: req.user._id,
          products,
          totalAmount,
          orderType,
          scheduleTime,
          shippingAddress,
          userInfo,
          promoCode: promoCode || null,
          promoDiscount: promoDiscount || 0,
          subtotal: subtotal || 0,
          discountedSubtotal: discountedSubtotal || 0,
          shippingCost: shippingCost || 0,
          specialInstructions: specialInstructions || null,
          adminStartTime: ADMIN_START_TIME, // ✅ 7 PM
          orderCreatedAt: new Date(), // ✅ When order created
          isNotified: false, // ✅ Email pending
        },
      ],
      { session }
    );

    const createdOrder = order[0];

    // Update promo orderId
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
      message: `Order created successfully. Store will be notified at ${ADMIN_START_TIME}`,
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
});

// ✅ CRON JOB - Check every minute if admin time reached
const checkAndSendNotifications = asyncWrapper(async (req, res) => {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5); // "19:00"

  // Find orders waiting for notification (created today, not notified)
  const pendingOrders = await Order.find({
    isNotified: false,
    orderCreatedAt: {
      $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()), // Today
    },
  })
    .populate("products.product")
    .populate("user", "firstName lastName email");

  const notifiedOrders = [];

  for (let order of pendingOrders) {
    // ✅ If admin start time reached, send email
    if (currentTime >= order.adminStartTime) {
      try {
        await sendAdminNotification(order);
        order.isNotified = true;
        order.notificationSentAt = new Date();
        await order.save();
        notifiedOrders.push(order._id);
      } catch (error) {
        console.error(`Failed to notify order ${order._id}:`, error);
      }
    }
  }

  res.json({
    success: true,
    checkedAt: new Date().toISOString(),
    pendingOrders: pendingOrders.length,
    notifiedToday: notifiedOrders.length,
    notifiedOrderIds: notifiedOrders,
  });
});

// ✅ Send email to admin
const sendAdminNotification = async (order) => {
  // Using your existing EmailJS setup or nodemailer
  const nodemailer = require("nodemailer");

  const transporter = nodemailer.createTransporter({
    service: "gmail",
    auth: {
      user: process.env.ADMIN_EMAIL, // your-admin@gmail.com
      pass: process.env.ADMIN_EMAIL_PASS, // App password
    },
  });

  const itemsList = order.products
    .map(
      (item) =>
        `${
          item.product?.name?.[order.user.language] ||
          item.product?.name ||
          item.name ||
          "Product"
        } (x${item.quantity}) - ${(item.price * item.quantity).toFixed(3)} kw`
    )
    .join("<br>");

  const mailOptions = {
    from: process.env.ADMIN_EMAIL,
    to: process.env.STORE_EMAIL, // store-admin@gmail.com
    subject: `🆕 NEW ORDER #${order._id.slice(-6).toUpperCase()}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">New Order Received!</h2>
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Order: #${order._id.slice(-6).toUpperCase()}</h3>
          <p><strong>Customer:</strong> ${order.userInfo.name}</p>
          <p><strong>Phone:</strong> ${order.userInfo.phone}</p>
          <p><strong>Total:</strong> ${order.totalAmount.toFixed(3)} kw</p>
          <p><strong>Type:</strong> ${
            order.orderType === "pickup" ? "Pickup" : "Delivery"
          }</p>
        </div>
        <h4>Items:</h4>
        <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
          ${itemsList}
        </div>
        <div style="margin: 20px 0;">
          <p><strong>Preferred Schedule:</strong> ${new Date(
            order.scheduleTime.date
          ).toLocaleDateString()} - ${order.scheduleTime.timeSlot}</p>
          ${
            order.specialInstructions
              ? `<p><strong>Special Notes:</strong> ${order.specialInstructions}</p>`
              : ""
          }
        </div>
        <hr style="border: 1px solid #e2e8f0;">
        <p style="color: #64748b; font-size: 14px;">
          <em>Notified at ${new Date().toLocaleString()}</em>
        </p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

// ✅ Get pending orders for admin dashboard
const getPendingOrders = asyncWrapper(async (req, res) => {
  const pendingOrders = await Order.find({
    isNotified: false,
    orderCreatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24h
  })
    .populate("products.product", "name images")
    .populate("user", "firstName lastName email")
    .sort({ orderCreatedAt: -1 });

  res.json({
    status: httpStatusText.SUCCESS,
    count: pendingOrders.length,
    data: pendingOrders,
  });
});

// ✅ Update admin start time
const updateAdminStartTime = asyncWrapper(async (req, res) => {
  const { time } = req.body; // "19:00"

  if (!time.match(/^\d{2}:\d{2}$/)) {
    throw new AppError("Time must be in HH:MM format", 400);
  }

  // Update global config (in production, use env or database)
  global.ADMIN_START_TIME = time;

  // Update existing pending orders
  await Order.updateMany({ isNotified: false }, { adminStartTime: time });

  res.json({
    status: httpStatusText.SUCCESS,
    message: `Admin start time updated to ${time}`,
    newTime: time,
  });
});

// ✅ Existing functions (unchanged)
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

module.exports = {
  createOrder,
  getOrders,
  getOrder,
  getAllOrders,
  updateOrderStatus,
  deleteOrder,
  checkAndSendNotifications,
  getPendingOrders,
  updateAdminStartTime,
};
