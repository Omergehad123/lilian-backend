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

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${FRONTEND_URL}/login?error=google_auth_failed`,
  }),
  (req, res) => {
    console.log("✅ GOOGLE CALLBACK REACHED!");
    console.log("req.user:", req.user);

    if (!req.user || !req.user.token) {
      console.log("❌ NO USER/TOKEN - PROBLEM!");
      return res.redirect(`${FRONTEND_URL}/login?error=no_token`);
    }

    // ✅ Set JWT cookie
    res.cookie("token", req.user.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // HTTPS only in prod
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    console.log("✅ Cookie set");

    // ✅ GET RETURN URL FROM QUERY PARAMS (sent from frontend)
    const returnUrl = req.query.returnUrl || "/";

    console.log("🔄 Redirecting to:", decodeURIComponent(returnUrl));

    // ✅ Redirect to wherever user came from
    res.redirect(decodeURIComponent(returnUrl));
  }
);

router.get("/me", (req, res) => {
  console.log("🍪 Cookies received:", req.cookies);
  const token = req.cookies.token;

  if (!token) {
    console.log("❌ No token in cookies");
    return res.status(401).json({ error: "No token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    User.findById(decoded.id)
      .select("-password")
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
