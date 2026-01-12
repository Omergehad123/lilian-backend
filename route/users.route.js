const express = require("express");
const router = express.Router();
const userController = require("../App/controllers/usersController");
const verifyToken = require("../App/middleware/verifyToken");

router.post("/guest-login", userController.loginAsGuest);

router.get("/", verifyToken, userController.getAllUser);

router.get("/admin", verifyToken, userController.getAllUsersAdmin);

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

router.post("/cart", verifyToken, userController.addToCart);

router.get("/cart", verifyToken, userController.getCart);

router.delete("/cart/:productId", verifyToken, userController.removeFromCart);

router.patch("/cart/:productId", verifyToken, userController.updateCartItem);

router.get("/me", verifyToken, userController.getMe);

module.exports = router;
