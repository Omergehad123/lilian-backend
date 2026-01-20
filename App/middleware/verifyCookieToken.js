const jwt = require("jsonwebtoken");
const User = require("../models/users.model");
const AppError = require("../../utils/appError");
const asyncWrapper = require("./asyncWrapper");

const verifyCookieToken = asyncWrapper(async (req, res, next) => {
  // ✅ READ FROM COOKIE (not header)
  const token = req.cookies?.token; // ✅ SAFE CHECK

  if (!token) {
    return next(new AppError("No token provided. Please login first.", 401));
  }

  try {
    // ✅ Verify JWT from cookie
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

    // ✅ Get user from DB
    const userId = decoded.id || decoded._id; // ✅ FIXED
    const user = await User.findById(userId).select("-password");

    if (!user) {
      return next(new AppError("User not found", 401));
    }

    // ✅ Attach user to req
    req.user = user;
    next();
  } catch (error) {
    return next(new AppError("Invalid token", 401));
  }
});

module.exports = verifyCookieToken;
