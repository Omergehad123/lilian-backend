// routes/cityAreas.js - WRAP ALL RESPONSES
const express = require("express");
const router = express.Router();
const CityArea = require("../App/models/CityArea");
const authMiddleware = require("../App/middleware/auth");

//  GET all cities (NO AUTH needed for dashboard display)
router.get("/", async (req, res) => {
  try {
    const cities = await CityArea.find({ isActive: true })
      .sort({ key: 1 })
      .lean();
    res.json({ success: true, cities });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

//  POST add new city (AUTH REQUIRED)
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { key, name, areas } = req.body;

    const existingCity = await CityArea.findOne({
      key: key.toUpperCase(),
      isActive: true,
    });
    if (existingCity) {
      return res.status(400).json({
        success: false,
        error: "City key already exists",
      });
    }

    const city = new CityArea({
      key: key.toUpperCase(),
      name,
      areas: areas || [],
    });

    await city.save();
    const populatedCity = await CityArea.findById(city._id).lean();

    res.status(201).json({ success: true, city: populatedCity });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

//  All other routes follow same pattern...
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const city = await CityArea.findOneAndUpdate(
      { _id: id, isActive: true },
      req.body,
      { new: true, runValidators: true }
    ).lean();

    if (!city) {
      return res.status(404).json({ success: false, error: "City not found" });
    }
    res.json({ success: true, city });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const city = await CityArea.findOneAndUpdate(
      { _id: id, isActive: true },
      { isActive: false },
      { new: true }
    ).lean();

    if (!city) {
      return res.status(404).json({ success: false, error: "City not found" });
    }
    res.json({ success: true, message: "City deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/add-area", authMiddleware, async (req, res) => {
  try {
    const { cityId, name, shippingPrice } = req.body;
    const city = await CityArea.findOne({ _id: cityId, isActive: true });

    if (!city) {
      return res.status(404).json({ success: false, error: "City not found" });
    }

    const existingArea = city.areas.find(
      (area) =>
        area.name.en.toLowerCase() === name.en.toLowerCase() ||
        area.name.ar.toLowerCase() === name.ar.toLowerCase()
    );

    if (existingArea) {
      return res.status(400).json({
        success: false,
        error: "Area already exists in this city",
      });
    }

    city.areas.push({
      name,
      shippingPrice: parseFloat(shippingPrice),
      isActive: true,
    });

    await city.save();
    const populatedCity = await CityArea.findById(city._id).lean();
    res.json({ success: true, city: populatedCity });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put("/areas/:areaId/toggle", authMiddleware, async (req, res) => {
  try {
    const { areaId } = req.params;
    const city = await CityArea.findOne({
      "areas._id": areaId,
      isActive: true,
    });

    if (!city) {
      return res.status(404).json({ success: false, error: "Area not found" });
    }

    const area = city.areas.id(areaId);
    area.isActive = !area.isActive;
    await city.save();

    const populatedCity = await CityArea.findById(city._id).lean();
    res.json({ success: true, city: populatedCity });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

// ✅ ADD THIS ROUTE (same pattern as add-area)
router.put("/update-area", authMiddleware, async (req, res) => {
  try {
    const { cityId, areaId, name, shippingPrice } = req.body;
    const city = await CityArea.findOne({ _id: cityId, isActive: true });

    if (!city) {
      return res.status(404).json({ success: false, error: "City not found" });
    }

    const areaIndex = city.areas.findIndex(
      (area) => area._id.toString() === areaId
    );
    if (areaIndex === -1) {
      return res.status(404).json({ success: false, error: "Area not found" });
    }

    // Check duplicate names
    const duplicateArea = city.areas.find(
      (area, index) =>
        index !== areaIndex &&
        (area.name.en.toLowerCase() === name.en.toLowerCase() ||
          area.name.ar.toLowerCase() === name.ar.toLowerCase())
    );

    if (duplicateArea) {
      return res.status(400).json({
        success: false,
        error: "Area name already exists in this city",
      });
    }

    // Update area
    city.areas[areaIndex] = {
      ...city.areas[areaIndex].toObject(),
      name,
      shippingPrice: parseFloat(shippingPrice),
    };

    await city.save();
    const populatedCity = await CityArea.findById(city._id).lean();
    res.json({ success: true, city: populatedCity });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});
