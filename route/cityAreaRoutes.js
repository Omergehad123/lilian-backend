const express = require("express");
const router = express.Router();
const CityArea = require("../App/models/CityArea");
const authMiddleware = require("../App/middleware/auth");

router.get("/", async (req, res) => {
  try {
    const cities = await CityArea.find({}).sort({ key: 1 }).lean();
    res.json({ success: true, cities });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
// POST add new city
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { key, name, areas } = req.body;

    // Check if city key already exists
    const existingCity = await CityArea.findOne({ key: key.toUpperCase() });
    if (existingCity) {
      return res
        .status(400)
        .json({ success: false, error: "City key already exists" });
    }

    const city = new CityArea({
      key: key.toUpperCase(),
      name,
      areas: areas || [],
    });

    await city.save();
    res.status(201).json({ success: true, city });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// PUT update city
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const city = await CityArea.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!city) {
      return res.status(404).json({ success: false, error: "City not found" });
    }

    res.json({ success: true, city });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// DELETE city
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const city = await CityArea.findByIdAndDelete(id);

    if (!city) {
      return res.status(404).json({ success: false, error: "City not found" });
    }

    res.json({ success: true, message: "City deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST add area to specific city
router.post("/add-area", authMiddleware, async (req, res) => {
  try {
    const { cityId, name, shippingPrice } = req.body;

    const city = await CityArea.findById(cityId);
    if (!city) {
      return res.status(404).json({ success: false, error: "City not found" });
    }

    // Check if area already exists
    const existingArea = city.areas.find(
      (area) =>
        area.name.en.toLowerCase() === name.en.toLowerCase() ||
        area.name.ar.toLowerCase() === name.ar.toLowerCase()
    );

    if (existingArea) {
      return res
        .status(400)
        .json({ success: false, error: "Area already exists in this city" });
    }

    city.areas.push({
      name,
      shippingPrice: parseFloat(shippingPrice),
      isActive: true,
    });

    await city.save();
    res.json({ success: true, city });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// PUT toggle area status
router.put("/areas/:areaId/toggle", authMiddleware, async (req, res) => {
  try {
    const { areaId } = req.params;
    const city = await CityArea.findOne({
      "areas._id": areaId,
    });

    if (!city) {
      return res.status(404).json({ success: false, error: "Area not found" });
    }

    const area = city.areas.id(areaId);
    area.isActive = !area.isActive;

    await city.save();
    res.json({ success: true, city });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
