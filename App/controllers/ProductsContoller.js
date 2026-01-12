const Product = require("../models/products.model");
const asyncWrapper = require("../middleware/asyncWrapper");
const AppError = require("../../utils/appError");
const httpStatusText = require("../../utils/httpStatusText");
const slugify = require("slugify");

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

    return {
      ...prod,
      slug: `${baseSlug}-${Date.now()}-${index}`, // 🔥 unique 100%
      actualPrice: Number(prod.actualPrice),
      price:
        prod.price !== undefined && prod.price !== ""
          ? Number(prod.price)
          : Number(prod.actualPrice),
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

  // Toggle availability
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
  const products = await Product.find();
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
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) {
    return next(new AppError("Product not found", 404));
  }

  res.json({
    status: httpStatusText.SUCCESS,
    message: "Product deleted",
  });
});

const updateProduct = asyncWrapper(async (req, res, next) => {
  const { id } = req.params;
  const updateData = { ...req.body };

  // If name.en is provided, update slug
  if (updateData.name?.en) {
    const baseSlug = slugify(updateData.name.en, {
      lower: true,
      strict: true,
      trim: true,
    });
    updateData.slug = `${baseSlug}-${Date.now()}`;
  }

  // Convert price fields to numbers if provided
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
