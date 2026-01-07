const mongoose = require("mongoose");
const userRoles = require("../../utils/roles");

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    token: {
      type: String,
    },
    role: {
      type: String,
      enum: [userRoles.USER, userRoles.ADMIN, userRoles.MANAGER],
      default: userRoles.USER,
    },
    cart: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: {
          type: Number,
          default: 1,
          min: 1,
        },
        price: {
          type: Number,
          required: true,
        },
      },
    ],
    orders: [
      {
        items: [
          {
            product: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "Product",
              required: true,
            },
            quantity: { type: Number, required: true, min: 1 },
            price: { type: Number, required: true },
            message: { type: String, default: "", maxlength: 100 }, // رسالة لكل منتج
          },
        ],
        totalAmount: { type: Number, required: true },
        orderType: {
          type: String,
          enum: ["delivery", "pickup"],
          required: true,
        },
        scheduledTime: { type: Date, required: true },
        shippingAddress: {
          street: String,
          city: String,
          country: String,
        },
        status: {
          type: String,
          enum: ["pending", "confirmed", "shipped", "delivered", "cancelled"],
          default: "pending",
        },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);
