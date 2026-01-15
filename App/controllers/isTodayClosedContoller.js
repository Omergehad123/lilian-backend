const ClosedSchedule = require("../models/ClosedSchedule");

const isCloseToday = async (req, res) => {
  try {
    const today = new Date();
    const todayString = today.toISOString().split("T")[0];

    const isClosed = await ClosedSchedule.findOne({ date: todayString });
    const currentHour = new Date().getHours();
    const timeBasedClosed = currentHour >= 21;

    res.json({
      isClosed: !!isClosed || timeBasedClosed,
      date: todayString,
      timeBasedClosed,
      manuallyClosed: !!isClosed,
    });
  } catch (error) {
    console.error("Check closed error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = isCloseToday;
