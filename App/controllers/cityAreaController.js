const CityArea = require("../models/CityArea");

// Get all cities with areas
exports.getCities = async (req, res) => {
  try {
    const cities = await CityArea.find({}).sort({ key: 1 });
    res.json({ success: true, cities });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Add new city
exports.addCity = async (req, res) => {
  try {
    const { key, name, areas } = req.body;
    const city = new CityArea({
      key: key.toUpperCase(),
      name,
      areas: areas || [],
    });
    await city.save();
    res.json({ success: true, city });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// Update city
exports.updateCity = async (req, res) => {
  try {
    const { id } = req.params;
    const city = await CityArea.findByIdAndUpdate(id, req.body, { new: true });
    if (!city) {
      return res.status(404).json({ success: false, error: "City not found" });
    }
    res.json({ success: true, city });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// Delete city
exports.deleteCity = async (req, res) => {
  try {
    const { id } = req.params;
    await CityArea.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Add area to city
exports.addAreaToCity = async (req, res) => {
  try {
    const { cityId, name, shippingPrice } = req.body;
    const city = await CityArea.findById(cityId);
    if (!city) {
      return res.status(404).json({ success: false, error: "City not found" });
    }

    city.areas.push({
      name,
      shippingPrice: parseFloat(shippingPrice),
    });
    await city.save();
    res.json({ success: true, city });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};
