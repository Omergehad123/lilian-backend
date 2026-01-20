const express = require("express");
const router = express.Router();
const userController = require("../App/controllers/usersController");
const verifyToken = require("../App/middleware/verifyToken");
const verifyCookieToken = require("../App/middleware/verifyCookieToken"); // ✅ NEW
const verifyAdminToken = require("../App/middleware/verifyAdminToken"); // ✅ NEW
const allowTo = require("../App/middleware/allowTo");
const userRoles = require("../utils/roles");

router.post("/guest-login", userController.loginAsGuest);

router.get("/", verifyCookieToken, userController.getAllUser); // ✅ FIXED

router.get(
  "/admin",
  verifyAdminToken,
  allowTo(userRoles.ADMIN, userRoles.MANAGER),
  userController.getAllUsersAdmin
); // ✅ PROTECTED

router.post("/login", userController.login);

router.post("/register", userController.register);

router.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  res.json({ message: "Logged out successfully" });
});

router.post("/cart", verifyCookieToken, userController.addToCart); // ✅ FIXED

router.get("/cart", verifyCookieToken, userController.getCart); // ✅ FIXED

router.delete("/cart/:productId", verifyCookieToken, userController.removeFromCart); // ✅ FIXED

router.patch("/cart/:productId", verifyCookieToken, userController.updateCartItem); // ✅ FIXED

router.get("/me", verifyCookieToken, userController.getMe); // ✅ FIXED

module.exports = router;
