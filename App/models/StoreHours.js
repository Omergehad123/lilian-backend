const mongoose = require("mongoose");

const storeHoursSchema = new mongoose.Schema(
  {
    dayOfWeek: {
      type: Number, // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      required: true,
    },
    durations: [
      {
        startTime: {
          type: String, // "14:00" format (HH:MM)
          required: true,
        },
        endTime: {
          type: String, // "17:00" format (HH:MM)
          required: true,
        },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("StoreHours", storeHoursSchema);
