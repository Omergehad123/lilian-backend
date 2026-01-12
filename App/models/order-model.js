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
      city: {
        type: String,
        required: [true, "City is required"],
      },
      area: {
        type: String,
        required: [
          function () {
            return this.orderType === "delivery";
          },
          "Area is required for delivery",
        ],
      },
      street: {
        type: String,
        required: [
          function () {
            return this.orderType === "delivery";
          },
          "Street is required for delivery",
        ],
      },
      block: {
        type: Number,
        required: [
          function () {
            return this.orderType === "delivery";
          },
          "Block is required for delivery",
        ],
      },
      house: {
        type: Number,
        required: [
          function () {
            return this.orderType === "delivery";
          },
          "House number is required for delivery",
        ],
      },
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
    promoCode: {
      type: String,
      uppercase: true,
    },
    promoDiscount: {
      type: Number,
      default: 0,
    },
    subtotal: { type: Number },
    shippingCost: { type: Number },
    totalAmount: { type: Number, required: true },
    specialInstructions: {
      type: String,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "cancelled", "refunded"],
      default: "pending",
    },
    paymentPending: {
      type: Boolean,
      default: false,
    },
    myfatoorahPaymentId: String,
    myfatoorahInvoiceId: String,
    paidAmount: Number,
    paymentCompletedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
