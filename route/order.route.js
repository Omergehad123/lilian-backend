const express = require("express");
const router = express.Router();
const {
  createOrder,
  getOrders,
  getOrder,
  getAllOrders,
  updateOrderStatus,
  deleteOrder, // ✅ IMPORTED
} = require("../App/controllers/OrderController");
const verifyCookieToken = require("../App/middleware/verifyCookieToken");
const verifyToken = require("../App/middleware/verifyToken");
const allowTo = require("../App/middleware/allowTo");
const userRoles = require("../utils/roles");

// ✅ CUSTOMER ROUTES (COOKIE AUTH)
router.post("/", verifyCookieToken, createOrder);
router.get("/", verifyCookieToken, getOrders);
router.get("/:id", verifyCookieToken, getOrder);
router.delete("/:id", verifyCookieToken, deleteOrder); // ✅ DELETE ROUTE ADDED HERE

// ✅ ADMIN ROUTES (BEARER TOKEN)
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

module.exports = router;
