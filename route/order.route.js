const express = require("express");
const router = express.Router();
const {
  createOrder,
  getOrders,
  getOrder,
  getAllOrders,
  updateOrderStatus,
} = require("../App/controllers/OrderController");
const verifyToken = require("../App/middleware/verifyToken");
const allowTo = require("../App/middleware/allowTo");
const userRoles = require("../utils/roles");

// Create a new order
router.post("/", verifyToken, createOrder);

// Get all orders of the logged-in user
router.get("/", verifyToken, getOrders);

// Admin routes
router.get(
  "/admin/all",
  verifyToken,
  allowTo(userRoles.ADMIN, userRoles.MANAGER),
  getAllOrders
);

router.patch(
  "/:id/status",
  verifyToken,
  allowTo(userRoles.ADMIN, userRoles.MANAGER),
  updateOrderStatus
);

// Get a single order by ID
router.get("/:id", verifyToken, getOrder);

module.exports = router;
