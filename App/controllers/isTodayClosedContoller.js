const asyncWrapper = require("../middleware/asyncWrapper");
const AppError = require("../../utils/appError");
const httpStatusText = require("../../utils/httpStatusText");
const ClosedSchedule = require("../models/ClosedSchedule");

const isCloseToday = asyncWrapper(async (req, res, next) => {
  const today = new Date();
  const todayString = today.toISOString().split("T")[0];

  let isClosed;
  try {
    isClosed = await ClosedSchedule.findOne({ date: todayString });
  } catch (error) {
    return next(new AppError("Database error checking closed status", 500));
  }

  const currentHour = new Date().getHours();
  const timeBasedClosed = currentHour >= 21;

  try {
    return res.status(200).json({
      status: httpStatusText.SUCCESS,
      data: {
        isClosed: !!isClosed || timeBasedClosed,
        date: todayString,
        timeBasedClosed,
        manuallyClosed: !!isClosed,
      },
    });
  } catch (error) {
    return next(new AppError("Failed to check schedule status", 500));
  }
});

module.exports = isCloseToday;
