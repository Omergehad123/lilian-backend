const express = require("express");
const router = express.Router();
const CityArea = require("../App/models/CityArea");
const authMiddleware = require("../App/middleware/auth");
const {
  getCities,
  addCity,
  updateCity,
  deleteCity,
  addAreaToCity,
  updateAreaInCity,
  toggleAreaStatus,
} = require("../App/controllers/cityAreaController");

// ✅ 1. GET / - List cities (NO AUTH)
router.get("/", getCities);

// ✅ 2. POST / - Add city (AUTH)
router.post("/", authMiddleware, addCity);

// ✅ 3. POST /update-area - Update area (AUTH) - BEFORE :id routes!
router.post("/update-area", authMiddleware, updateAreaInCity);

// ✅ 4. POST /add-area - Add area (AUTH)
router.post("/add-area", authMiddleware, addAreaToCity);

// ✅ 5. PUT /areas/:areaId/toggle - Toggle area (AUTH)
router.put("/areas/:areaId/toggle", authMiddleware, toggleAreaStatus);

// ✅ 6. GENERIC :id ROUTES LAST
router.put("/:id", authMiddleware, updateCity);
router.delete("/:id", authMiddleware, deleteCity);

module.exports = router;
