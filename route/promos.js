const express = require("express");
const router = express.Router();
const Promo = require("../App/models/Promo");
const auth = require("../App/middleware/auth"); // Admin auth middleware

// GET all promos
router.get("/", auth, async (req, res) => {
  try {
    const promos = await Promo.find().sort({ createdAt: -1 });
    res.json({ success: true, promos });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// CREATE new promo
router.post("/", auth, async (req, res) => {
  try {
    const { code, discountPercent, maxUses, expiryDate, description } =
      req.body;

    // Check if code already exists
    const existingPromo = await Promo.findOne({ code });
    if (existingPromo) {
      return res.status(400).json({
        success: false,
        message: "Promo code already exists",
      });
    }

    const promo = new Promo({
      code,
      discountPercent,
      maxUses: maxUses || null,
      expiryDate: expiryDate || null,
      description: description || { en: "", ar: "" },
    });

    await promo.save();
    res.status(201).json({ success: true, promo });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// UPDATE promo
router.put("/:id", auth, async (req, res) => {
  try {
    const promo = await Promo.findById(req.params.id);
    if (!promo) {
      return res
        .status(404)
        .json({ success: false, message: "Promo not found" });
    }

    const { code, discountPercent, maxUses, expiryDate, description } =
      req.body;

    // Check if code already exists (excluding current promo)
    const existingPromo = await Promo.findOne({
      code,
      _id: { $ne: req.params.id },
    });
    if (existingPromo) {
      return res.status(400).json({
        success: false,
        message: "Promo code already exists",
      });
    }

    promo.code = code;
    promo.discountPercent = discountPercent;
    promo.maxUses = maxUses || null;
    promo.expiryDate = expiryDate || null;
    promo.description = description || promo.description;

    await promo.save();
    res.json({ success: true, promo });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// TOGGLE status
router.patch("/:id/toggle", auth, async (req, res) => {
  try {
    const promo = await Promo.findById(req.params.id);
    if (!promo) {
      return res
        .status(404)
        .json({ success: false, message: "Promo not found" });
    }

    promo.isActive = !promo.isActive;
    await promo.save();

    res.json({
      success: true,
      promo,
      message: `Promo ${promo.isActive ? "activated" : "deactivated"}`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE promo
router.delete("/:id", auth, async (req, res) => {
  try {
    const promo = await Promo.findByIdAndDelete(req.params.id);
    if (!promo) {
      return res
        .status(404)
        .json({ success: false, message: "Promo not found" });
    }
    res.json({ success: true, message: "Promo deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// VALIDATE promo code
router.post("/validate", async (req, res) => {
  try {
    const { code } = req.body;

    const promo = await Promo.findOne({
      code: code.toUpperCase(),
      isActive: true,
    });

    if (!promo) {
      return res.json({
        success: false,
        message: "Promo code not found or inactive",
      });
    }

    // Check expiry date
    if (promo.expiryDate && new Date(promo.expiryDate) < new Date()) {
      return res.json({
        success: false,
        message: "Promo code expired",
      });
    }

    // Check usage limit
    if (promo.maxUses && promo.currentUses >= promo.maxUses) {
      return res.json({
        success: false,
        message: "Promo code usage limit reached",
      });
    }

    res.json({
      success: true,
      promo: {
        code: promo.code,
        discountPercent: promo.discountPercent,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
