const express = require("express");
const router = express.Router();
const userController = require("../App/controllers/usersController");
const verifyToken = require("../App/middleware/verifyToken");

router.get("/", verifyToken, userController.getAllUser);

router.get("/admin", verifyToken, userController.getAllUsersAdmin);

router.post("/login", userController.login);

router.post("/register", userController.register);

router.post("/cart", verifyToken, userController.addToCart);

router.get("/cart", verifyToken, userController.getCart);

router.delete("/cart/:productId", verifyToken, userController.removeFromCart);

router.patch("/cart/:productId", verifyToken, userController.updateCartItem);

module.exports = router;
