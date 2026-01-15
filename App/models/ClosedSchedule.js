const mongoose = require("mongoose");

const closedScheduleSchema = new mongoose.Schema({
  date: {
    type: String,
    required: true,
    unique: true,
  },
  closedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  closedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("ClosedSchedule", closedScheduleSchema);
