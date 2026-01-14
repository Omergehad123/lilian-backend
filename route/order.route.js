const express = require("express");
const router = express.Router();
const {
  createOrder,
  getOrders,
  getOrder,
  getAllOrders,
  updateOrderStatus,
  deleteOrder,
} = require("../App/controllers/OrderController");
const verifyCookieToken = require("../App/middleware/verifyCookieToken");
const allowTo = require("../App/middleware/allowTo");
const userRoles = require("../utils/roles");
const verifyAdminToken = require("../App/middleware/verifyAdminToken");

// ✅ ADMIN ROUTES (BEARER TOKEN)
router.get(
  "/admin/all",
  verifyAdminToken,
  allowTo(userRoles.ADMIN, userRoles.MANAGER),
  getAllOrders
);
router.patch(
  "/:id/status",
  verifyAdminToken,
  allowTo(userRoles.ADMIN, userRoles.MANAGER),
  updateOrderStatus
);
// ✅ CUSTOMER ROUTES (COOKIE AUTH)
router.post("/", verifyCookieToken, createOrder);
router.get("/", verifyCookieToken, getOrders);
router.get("/:id", verifyCookieToken, getOrder);
router.delete("/:id", verifyCookieToken, deleteOrder); // ✅ DELETE ROUTE ADDED HERE

module.exports = router;
