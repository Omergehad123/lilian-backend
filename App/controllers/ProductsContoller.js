const Product = require("../models/products.model");
const asyncWrapper = require("../middleware/asyncWrapper");
const AppError = require("../../utils/appError");
const httpStatusText = require("../../utils/httpStatusText");
const slugify = require("slugify");
const { uploadToCloudinary } = require("../middleware/multerConfig"); // ✅ CORRECT IMPORT

const addProducts = asyncWrapper(async (req, res, next) => {
  console.log("Files received:", req.files?.length || 0); // Debug log

  const productsData = Array.isArray(req.body) ? req.body : [req.body];

  if (!productsData.length) {
    return next(new AppError("No products provided", 400));
  }

  const preparedProducts = [];

  for (let i = 0; i < productsData.length; i++) {
    const prod = productsData[i];

    if (!prod.name?.en || !prod.category?.en || !prod.actualPrice) {
      return next(
        new AppError("name.en, category.en, actualPrice are required", 400)
      );
    }

    const baseSlug = slugify(prod.name.en, {
      lower: true,
      strict: true,
      trim: true,
    });

    // Handle images - NEW uploads OR legacy URL
    const images = [];

    if (req.files && req.files.length > 0) {
      console.log(`Uploading ${req.files.length} images to Cloudinary...`);
      for (const file of req.files) {
        try {
          const imageUrl = await uploadToCloudinary(file.buffer);
          images.push(imageUrl);
          console.log("✅ Uploaded:", imageUrl);
        } catch (error) {
          console.error("❌ Cloudinary upload failed:", error.message);
          return next(
            new AppError(`Image upload failed: ${error.message}`, 500)
          );
        }
      }
    }

    preparedProducts.push({
      ...prod,
      slug: `${baseSlug}-${Date.now()}-${i}`,
      actualPrice: Number(prod.actualPrice),
      price: prod.price ? Number(prod.price) : Number(prod.actualPrice),
      images, // Array of Cloudinary URLs
      image: images[0] || prod.image || null, // Legacy single image field
    });
  }

  const newProducts = await Product.insertMany(preparedProducts);

  res.status(201).json({
    status: httpStatusText.SUCCESS,
    count: newProducts.length,
    data: newProducts,
  });
});

const getAllProducts = asyncWrapper(async (req, res) => {
  // ✅ ADMIN PANEL: Show ALL products (available + unavailable)
  // ✅ CUSTOMER FRONTEND: Use query param ?customer=true
  const isCustomerView = req.query.customer === "true";

  if (isCustomerView) {
    // Customer view - only available products
    const products = await Product.find({ isAvailable: true });
    return res.json({
      status: httpStatusText.SUCCESS,
      data: products,
    });
  }

  // Admin view - ALL products (like before)
  const products = await Product.find();
  res.json({
    status: httpStatusText.SUCCESS,
    data: products,
  });
});

const getProduct = asyncWrapper(async (req, res, next) => {
  const product = await Product.findOne({
    slug: req.params.slug,
    isAvailable: true,
  });
  if (!product) {
    return next(new AppError("Product not found", 404));
  }
  res.json({
    status: httpStatusText.SUCCESS,
    data: product,
  });
});

const updateProduct = asyncWrapper(async (req, res, next) => {
  const { id } = req.params;
  const updateData = { ...req.body };

  // Update slug if name changed
  if (updateData.name?.en) {
    const baseSlug = slugify(updateData.name.en, {
      lower: true,
      strict: true,
      trim: true,
    });
    updateData.slug = `${baseSlug}-${Date.now()}`;
  }

  // Add new images (keep existing ones)
  if (req.files && req.files.length > 0) {
    const existingProduct = await Product.findById(id);
    const currentImages = existingProduct?.images || [];

    for (const file of req.files) {
      try {
        const imageUrl = await uploadToCloudinary(file.buffer);
        currentImages.push(imageUrl);
      } catch (error) {
        return next(new AppError(`Image upload failed: ${error.message}`, 500));
      }
    }

    updateData.images = currentImages;
    updateData.image = currentImages[0];
  }

  // Convert prices to numbers
  if (updateData.actualPrice !== undefined) {
    updateData.actualPrice = Number(updateData.actualPrice);
  }
  if (updateData.price !== undefined) {
    updateData.price = Number(updateData.price);
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

const deleteProduct = asyncWrapper(async (req, res, next) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) {
    return next(new AppError("Product not found", 404));
  }
  res.json({
    status: httpStatusText.SUCCESS,
    message: "Product deleted successfully",
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

module.exports = {
  addProducts,
  getAllProducts,
  getProduct,
  deleteProduct,
  updateProduct,
  toggleProductAvailability,
};
