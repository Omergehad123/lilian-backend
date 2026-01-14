// middleware/verifyAdminToken.js - NEW FILE
const jwt = require("jsonwebtoken");
const User = require("../models/users.model");
const AppError = require("../../utils/appError");
const asyncWrapper = require("./asyncWrapper");

const verifyAdminToken = asyncWrapper(async (req, res, next) => {
  let token;

  // ✅ CHECK 1: Bearer token in header (Dashboard)
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }
  // ✅ CHECK 2: Cookie token (regular app)
  else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return next(new AppError("No token provided. Please login first.", 401));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return next(new AppError("User not found", 401));
    }

    // ✅ ADMIN CHECK HAPPENS HERE IN allowTo middleware
    req.user = user;
    next();
  } catch (error) {
    return next(new AppError("Invalid token", 401));
  }
});

module.exports = verifyAdminToken;
