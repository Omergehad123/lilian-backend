const express = require("express");
const router = express.Router();
const {
  createOrder,
  getOrders,
  getOrder,
} = require("../App/controllers/OrderController");
const verifyToken = require("../App/middleware/verifyToken");

// Create a new order
router.post("/", verifyToken, createOrder);

// Get all orders of the logged-in user
router.get("/", verifyToken, getOrders);

// Get a single order by ID
router.get("/:id", verifyToken, getOrder);

module.exports = router;
