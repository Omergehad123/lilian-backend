const express = require("express");
const passport = require("../utils/passport");
const router = express.Router();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5174";

// ✅ GOOGLE ROUTES (unchanged)
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${FRONTEND_URL}/login`,
  }),
  (req, res) => {
    const user = req.user;
    const encodedUser = encodeURIComponent(JSON.stringify(user));
    res.redirect(`${FRONTEND_URL}auth/success?user=${encodedUser}`);
  }
);

module.exports = router;
