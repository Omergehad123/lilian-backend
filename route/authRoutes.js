const express = require("express");
const passport = require("../utils/passport");
const jwt = require("jsonwebtoken");
const User = require("../App/models/users.model"); // Adjust path
const router = express.Router();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5174";

// Google OAuth START
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Google OAuth CALLBACK - FIXED
router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${FRONTEND_URL}/login`,
  }),
  (req, res) => {
    console.log("✅ GOOGLE CALLBACK REACHED!"); // ← ADD THIS
    console.log("req.user:", req.user); // ← ADD THIS

    if (!req.user || !req.user.token) {
      console.log("❌ NO USER/TOKEN - PROBLEM!");
      return res.redirect(`${FRONTEND_URL}/login`);
    }

    res.cookie("token", req.user.token, {
      httpOnly: true,
      secure: true, // Render = HTTPS
      sameSite: "none", // Cross-site cookies
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    console.log("✅ Cookie set, redirecting..."); // ← ADD THIS
    res.redirect(`${FRONTEND_URL}/`);
  }
);

// ✅ NEW: Get current user (for frontend)
router.get("/me", (req, res) => {
  console.log("🍪 Cookies received:", req.cookies); // ← ADD THIS
  const token = req.cookies.token;

  if (!token) {
    console.log("❌ No token in cookies");
    return res.status(401).json({ error: "No token" });
  }

  if (!token) {
    return res.status(401).json({ error: "No token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    User.findById(decoded.id)
      .select("-password") // Don't send password
      .then((user) => {
        if (!user) {
          return res.status(401).json({ error: "User not found" });
        }
        res.json({ user });
      })
      .catch((err) => res.status(500).json({ error: "Server error" }));
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
});

module.exports = router;
