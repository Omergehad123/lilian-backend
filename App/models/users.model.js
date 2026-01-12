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
      default: "", // ✅ Allow empty for guests
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: function () {
        // ✅ Optional for guests
        return !this.isGuest;
      },
    },
    token: {
      type: String,
    },
    isGuest: {
      // ✅ NEW: Guest flag
      type: Boolean,
      default: false,
    },
    guestId: {
      // ✅ NEW: Track guest users
      type: String,
      unique: true,
      sparse: true, // allows multiple null values
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
    usedPromoCodes: [
      {
        promoCode: {
          type: String,
          required: true,
          uppercase: true,
        },
        usedAt: {
          type: Date,
          default: Date.now,
        },
        orderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Order",
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);
