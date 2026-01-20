const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    isGuest: {
      type: Boolean,
      default: false,
    },

    guestInfo: {
      name: String,
      phone: String,
      email: String,
    },

    products: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: Number,
        price: Number,
      },
    ],

    subtotal: Number,
    shippingCost: Number,
    promoCode: String,
    promoDiscount: Number,
    totalAmount: Number,

    orderType: {
      type: String,
      enum: ["pickup", "delivery"],
      required: true,
    },

    scheduleTime: Object,
    shippingAddress: Object,

    status: {
      type: String,
      enum: ["pending", "paid", "confirmed", "completed", "cancelled"],
      default: "pending",
    },

    isPaid: {
      type: Boolean,
      default: false,
    },

    paymentMethod: String,

    // 🔥 IMPORTANT
    paymentId: String,
    invoiceId: String,

    paidAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
