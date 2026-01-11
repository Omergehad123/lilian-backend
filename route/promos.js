// routes/promos.js
const express = require("express");
const router = express.Router();
const Promo = require("../App/models/Promo");
const User = require("../App/models/users.model");
const auth = require("../App/middleware/auth");

// GET all promos (Admin only)
router.get("/", auth, async (req, res) => {
  try {
    const promos = await Promo.find().sort({ createdAt: -1 });
    res.json({ success: true, promos });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// CREATE new promo (Admin only)
router.post("/", auth, async (req, res) => {
  try {
    const { code, discountPercent, maxUses, expiryDate, description } =
      req.body;

    // Check if code already exists
    const existingPromo = await Promo.findOne({ code: code.toUpperCase() });
    if (existingPromo) {
      return res.status(400).json({
        success: false,
        message: "Promo code already exists",
      });
    }

    const promo = new Promo({
      code: code.toUpperCase(),
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

// UPDATE promo (Admin only)
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
      code: code.toUpperCase(),
      _id: { $ne: req.params.id },
    });
    if (existingPromo) {
      return res.status(400).json({
        success: false,
        message: "Promo code already exists",
      });
    }

    promo.code = code.toUpperCase();
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

// TOGGLE status (Admin only)
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

// DELETE promo (Admin only)
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

// ✅ VALIDATE PROMO - لكل المستخدمين
router.post("/validate", auth, async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user._id; // ✅ من auth middleware

    // البحث عن الـ promo
    const promo = await Promo.findOne({
      code: code.toUpperCase(),
      isActive: true,
    });

    if (!promo) {
      return res.status(400).json({
        success: false,
        message: "كود الخصم غير صحيح أو غير مفعل",
      });
    }

    // فحص تاريخ الانتهاء
    if (promo.expiryDate && new Date(promo.expiryDate) < new Date()) {
      return res.status(400).json({
        success: false,
        message: "انتهت صلاحية كود الخصم",
      });
    }

    // فحص عدد الاستخدامات الكلي
    if (promo.maxUses && promo.currentUses >= promo.maxUses) {
      return res.status(400).json({
        success: false,
        message: "تم استهلاك كود الخصم بالكامل",
      });
    }

    // ✅ فحص إذا كان اليوزر استخدمه من قبل
    const user = await User.findById(userId);
    const alreadyUsed = user.usedPromoCodes.some(
      (used) => used.promoCode.toUpperCase() === code.toUpperCase()
    );

    if (alreadyUsed) {
      return res.status(400).json({
        success: false,
        message: "لقد استخدمت هذا الكود من قبل",
      });
    }

    res.json({
      success: true,
      promo: {
        code: promo.code,
        discountPercent: promo.discountPercent,
        maxUses: promo.maxUses,
        currentUses: promo.currentUses,
      },
    });
  } catch (error) {
    console.error("Promo validation error:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في الخادم",
    });
  }
});

module.exports = router;
