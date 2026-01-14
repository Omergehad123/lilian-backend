const Product = require("../models/products.model");
const asyncWrapper = require("../middleware/asyncWrapper");
const AppError = require("../../utils/appError");
const httpStatusText = require("../../utils/httpStatusText");
const slugify = require("slugify");
const fs = require("fs").promises;
const path = require("path");

const addProducts = asyncWrapper(async (req, res, next) => {
  const products = Array.isArray(req.body) ? req.body : [req.body];

  if (!products.length) {
    return next(new AppError("No products provided", 400));
  }

  const preparedProducts = products.map((prod, index) => {
    if (!prod.name?.en || !prod.category || !prod.actualPrice) {
      throw new AppError("name.en, category, actualPrice are required", 400);
    }

    const baseSlug = slugify(prod.name.en, {
      lower: true,
      strict: true,
      trim: true,
    });

    // Handle images: prioritize files from multer, fallback to URL
    const images = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        images.push(`/uploads/products/${file.filename}`);
      });
    } else if (prod.image) {
      // Legacy: single image URL
      images.push(prod.image);
    }

    return {
      ...prod,
      slug: `${baseSlug}-${Date.now()}-${index}`,
      actualPrice: Number(prod.actualPrice),
      price:
        prod.price !== undefined && prod.price !== ""
          ? Number(prod.price)
          : Number(prod.actualPrice),
      images, // Always use images array
      image: images[0] || prod.image, // Keep legacy field for compatibility
    };
  });

  const newProducts = await Product.insertMany(preparedProducts);

  res.status(201).json({
    status: httpStatusText.SUCCESS,
    count: newProducts.length,
    data: newProducts,
  });
});

const toggleProductAvailability = asyncWrapper(async (req, res, next) => {
  const { id } = req.params;

  const product = await Product.findById(id);
  if (!product) {
    return next(new AppError("Product not found", 404));
  }

  product.isAvailable = !product.isAvailable;
  await product.save();

  res.json({
    status: httpStatusText.SUCCESS,
    data: {
      product,
      message: product.isAvailable
        ? "Product is now available"
        : "Product is unavailable",
    },
  });
});

const getAllProducts = asyncWrapper(async (req, res) => {
  const products = await Product.find().populate("images");
  res.json({
    status: httpStatusText.SUCCESS,
    data: products,
  });
});

const getProduct = asyncWrapper(async (req, res, next) => {
  const product = await Product.findOne({ slug: req.params.slug });
  if (!product) {
    return next(new AppError("Product not found", 404));
  }

  res.json({
    status: httpStatusText.SUCCESS,
    data: product,
  });
});

const deleteProduct = asyncWrapper(async (req, res, next) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return next(new AppError("Product not found", 404));
  }

  // Delete associated images
  if (product.images && product.images.length > 0) {
    for (const imagePath of product.images) {
      const fullPath = path.join(__dirname, "..", "..", imagePath);
      try {
        await fs.unlink(fullPath).catch(() => {}); // Ignore if file doesn't exist
      } catch (err) {
        console.error("Error deleting image:", fullPath, err);
      }
    }
  }

  await Product.findByIdAndDelete(req.params.id);

  res.json({
    status: httpStatusText.SUCCESS,
    message: "Product deleted",
  });
});

const updateProduct = asyncWrapper(async (req, res, next) => {
  const { id } = req.params;
  const updateData = { ...req.body };

  // Handle slug update
  if (updateData.name?.en) {
    const baseSlug = slugify(updateData.name.en, {
      lower: true,
      strict: true,
      trim: true,
    });
    updateData.slug = `${baseSlug}-${Date.now()}`;
  }

  // Handle new images upload
  if (req.files && req.files.length > 0) {
    // Get existing product to preserve old images if not replacing all
    const existingProduct = await Product.findById(id);
    const currentImages = existingProduct?.images || [];

    // Add new images
    const newImages = req.files.map(
      (file) => `/uploads/products/${file.filename}`
    );
    updateData.images = [...currentImages, ...newImages];
    updateData.image = newImages[0] || currentImages[0]; // Main image
  }

  // Convert price fields
  if (updateData.actualPrice !== undefined) {
    updateData.actualPrice = Number(updateData.actualPrice);
  }
  if (updateData.price !== undefined) {
    updateData.price =
      updateData.price !== ""
        ? Number(updateData.price)
        : updateData.actualPrice;
  }

  const product = await Product.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  });

  if (!product) {
    return next(new AppError("Product not found", 404));
  }

  res.json({
    status: httpStatusText.SUCCESS,
    data: product,
  });
});

module.exports = {
  addProducts,
  getAllProducts,
  getProduct,
  deleteProduct,
  updateProduct,
  toggleProductAvailability,
};
