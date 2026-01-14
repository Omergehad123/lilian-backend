const express = require("express");
const router = express.Router();
const productsController = require("../App/controllers/ProductsContoller");
const verifyAdminToken = require("../App/middleware/verifyAdminToken");
const allowTo = require("../App/middleware/allowTo");
const userRoles = require("../utils/roles");
const upload = require("../App/middleware/multerConfig");

router.get("/", productsController.getAllProducts);
router.get("/:slug", productsController.getProduct);

router.post(
  "/",
  upload.array("images", 5), // ✅ Support up to 5 images
  verifyAdminToken,
  allowTo(userRoles.ADMIN, userRoles.MANAGER),
  productsController.addProducts
);

router.delete(
  "/:id",
  verifyAdminToken,
  allowTo(userRoles.ADMIN),
  productsController.deleteProduct
);

router.patch(
  "/:id",
  upload.array("images", 5), // ✅ Support adding more images
  verifyAdminToken,
  allowTo(userRoles.ADMIN, userRoles.MANAGER),
  productsController.updateProduct
);

router.patch(
  "/:id/availability",
  verifyAdminToken,
  allowTo(userRoles.ADMIN, userRoles.MANAGER),
  productsController.toggleProductAvailability
);

module.exports = router;
