const Product = require("../models/products.model");
const asyncWrapper = require("../middleware/asyncWrapper");
const AppError = require("../../utils/appError");
const httpStatusText = require("../../utils/httpStatusText");
const slugify = require("slugify");
const { uploadToCloudinary } = require("../middleware/multerConfig");

const addProducts = asyncWrapper(async (req, res, next) => {
  const productsData = Array.isArray(req.body) ? req.body : [req.body];

  if (!productsData.length) {
    return next(new AppError("No products provided", 400));
  }

  const preparedProducts = [];
  for (let i = 0; i < productsData.length; i++) {
    const prod = productsData[i];

    if (!prod.name?.en || !prod.category?.en || !prod.actualPrice) {
      throw new AppError("name.en, category.en, actualPrice are required", 400);
    }

    const baseSlug = slugify(prod.name.en, {
      lower: true,
      strict: true,
      trim: true,
    });
    const images = [];

    // Upload images to Cloudinary
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const imageUrl = await uploadToCloudinary(file.buffer);
        images.push(imageUrl);
      }
    }

    preparedProducts.push({
      ...prod,
      slug: `${baseSlug}-${Date.now()}-${i}`,
      actualPrice: Number(prod.actualPrice),
      price: prod.price ? Number(prod.price) : Number(prod.actualPrice),
      images,
      image: images[0] || null,
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
  const products = await Product.find({ isAvailable: true });
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

  if (updateData.name?.en) {
    const baseSlug = slugify(updateData.name.en, {
      lower: true,
      strict: true,
      trim: true,
    });
    updateData.slug = `${baseSlug}-${Date.now()}`;
  }

  // Add new images
  if (req.files && req.files.length > 0) {
    const existingProduct = await Product.findById(id);
    const currentImages = existingProduct?.images || [];

    for (const file of req.files) {
      const imageUrl = await uploadToCloudinary(file.buffer);
      currentImages.push(imageUrl);
    }

    updateData.images = currentImages;
  }

  if (updateData.actualPrice !== undefined)
    updateData.actualPrice = Number(updateData.actualPrice);
  if (updateData.price !== undefined)
    updateData.price = Number(updateData.price);

  const product = await Product.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  });

  if (!product) return next(new AppError("Product not found", 404));

  res.json({
    status: httpStatusText.SUCCESS,
    data: product,
  });
});

const deleteProduct = asyncWrapper(async (req, res, next) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) return next(new AppError("Product not found", 404));

  res.json({
    status: httpStatusText.SUCCESS,
    message: "Product deleted successfully",
  });
});

const toggleProductAvailability = asyncWrapper(async (req, res, next) => {
  const { id } = req.params;
  const product = await Product.findById(id);
  if (!product) return next(new AppError("Product not found", 404));

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
