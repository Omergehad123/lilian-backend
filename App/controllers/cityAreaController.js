const CityArea = require("../models/CityArea");

exports.getCities = async (req, res) => {
  try {
    const cities = await CityArea.find({ isActive: true })
      .sort({ key: 1 })
      .lean();
    res.json({ success: true, cities });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.addCity = async (req, res) => {
  try {
    const { key, name, areas } = req.body;

    // ✅ VALIDATION - Fix the undefined error
    if (!key || typeof key !== "string") {
      return res.status(400).json({
        success: false,
        error: "City key is required and must be a string",
      });
    }

    if (!name?.en || !name?.ar) {
      return res.status(400).json({
        success: false,
        error: "City name (en and ar) is required",
      });
    }

    const upperKey = key.toUpperCase().trim();
    const existingCity = await CityArea.findOne({
      key: upperKey,
      isActive: true,
    });

    if (existingCity) {
      return res.status(400).json({
        success: false,
        error: "City key already exists",
      });
    }

    const city = new CityArea({
      key: upperKey,
      name,
      areas: areas || [],
    });

    await city.save();
    const populatedCity = await CityArea.findById(city._id).lean();

    res.status(201).json({ success: true, city: populatedCity });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

exports.updateCity = async (req, res) => {
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
};

exports.deleteCity = async (req, res) => {
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
};

exports.addAreaToCity = async (req, res) => {
  try {
    const { cityId, name, shippingPrice } = req.body;

    if (!cityId || !name?.en || !name?.ar || !shippingPrice) {
      return res.status(400).json({
        success: false,
        error: "cityId, name (en/ar), and shippingPrice are required",
      });
    }

    const city = await CityArea.findOne({ _id: cityId, isActive: true });
    if (!city) {
      return res.status(404).json({ success: false, error: "City not found" });
    }

    // ✅ Check duplicate areas
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
};

exports.toggleAreaStatus = async (req, res) => {
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
};
