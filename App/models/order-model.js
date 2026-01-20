const mongoose = require("mongoose")

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // ✅ guest friendly
    },

    isGuest: {
      type: Boolean,
      default: false,
    },

    guestInfo: {
      name: String,
      phone: String,
    },

    products: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: { type: Number, default: 1 },
        price: { type: Number, required: true },
        message: { type: String, default: "" },
      },
    ],

    orderType: {
      type: String,
      enum: ["pickup", "delivery"],
      required: true,
    },

    scheduleTime: {
      date: { type: Date, required: true },
      timeSlot: {
        type: String,
        enum: [
          "10:00 AM - 02:00 PM",
          "02:00 PM - 06:00 PM",
          "06:00 PM - 11:00 PM",
        ],
        required: true,
      },
    },

    shippingAddress: {
      city: String,
      area: String,
      street: String,
      block: Number,
      house: Number,
    },

    subtotal: Number,
    shippingCost: Number,
    totalAmount: { type: Number, required: true },

    status: {
      type: String,
      enum: ["pending", "confirmed", "completed", "cancelled", "paid"],
      default: "pending",
    },

    isPaid: { type: Boolean, default: false },
    paymentId: String,
    invoiceId: String,
    paymentMethod: {
      type: String,
      enum: ["card", "knet", "other"],
    },
    paidAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
