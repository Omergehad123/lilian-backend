const express = require("express");
const router = express.Router();
const productsController = require("../App/controllers/ProductsContoller");
const verifyAdminToken = require("../App/middleware/verifyAdminToken"); // ✅ CHANGE THIS
const allowTo = require("../App/middleware/allowTo");
const userRoles = require("../utils/roles");

router.get("/", productsController.getAllProducts);
router.get("/:slug", productsController.getProduct);

router.post(
  "/",
  verifyAdminToken, // ✅ FIXED
  allowTo(userRoles.ADMIN, userRoles.MANAGER),
  productsController.addProducts
);

router.delete(
  "/:id",
  verifyAdminToken, // ✅ FIXED
  allowTo(userRoles.ADMIN),
  productsController.deleteProduct
);

router.patch(
  "/:id",
  verifyAdminToken, // ✅ FIXED
  allowTo(userRoles.ADMIN, userRoles.MANAGER),
  productsController.updateProduct
);

router.patch(
  "/:id/availability",
  verifyAdminToken, // ✅ FIXED
  allowTo(userRoles.ADMIN, userRoles.MANAGER),
  productsController.toggleProductAvailability
);

module.exports = router;
