const express = require("express");
const passport = require("../utils/passport");
const router = express.Router();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5174";

// ✅ GOOGLE START (unchanged)
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// ✅ GOOGLE CALLBACK - FIXED
router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${FRONTEND_URL}/login`,
  }),
  (req, res) => {
    // ✅ SECURE: Set JWT cookie instead of URL param
    res.cookie("token", req.user.token, {
      httpOnly: true, // Can't be accessed by JavaScript
      secure: process.env.NODE_ENV === "production", // HTTPS only in prod
      sameSite: "strict", // CSRF protection
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.redirect(`${FRONTEND_URL}/`);
  }
);

module.exports = router;
