const mongoose = require("mongoose");

const promoSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "Promo code is required"],
      unique: true,
      uppercase: true,
      trim: true,
    },
    discountPercent: {
      type: Number,
      required: [true, "Discount percentage is required"],
      min: [1, "Discount must be at least 1%"],
      max: [90, "Discount cannot exceed 90%"],
    },
    maxUses: {
      type: Number,
      min: [0, "Max uses cannot be negative"],
      default: null, // null = unlimited
    },
    currentUses: {
      type: Number,
      default: 0,
    },
    expiryDate: {
      type: Date,
    },
    description: {
      en: { type: String, default: "" },
      ar: { type: String, default: "" },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Promo", promoSchema);
