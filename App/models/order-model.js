const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    products: [
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
        message: {
          type: String, // optional message per product
          default: "",
        },
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
    },
    orderType: {
      type: String,
      enum: ["pickup", "delivery"],
      required: true,
    },
    scheduleTime: {
      date: {
        type: Date,
        required: true,
      },
      timeSlot: {
        type: String,
        enum: [
          "08:00 AM - 01:00 PM",
          "01:00 PM - 06:00 PM",
          "06:00 PM - 11:00 PM",
        ],
        required: true,
      },
    },
    shippingAddress: {
      city: { type: String, required: true },
      area: { type: String, required: true },
      street: { type: String },
      block: { type: Number },
      house: { type: Number },
    },
    userInfo: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "completed", "cancelled"],
      default: "pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
