const User = require("../models/users.model");
const Product = require("../models/products.model");
const asyncWrapper = require("../middleware/asyncWrapper");
const AppError = require("../../utils/appError");
const httpStatusText = require("../../utils/httpStatusText");
const bcrypt = require("bcryptjs");
const generateJWT = require("../../utils/generateJWT");

const getAllUser = asyncWrapper(async (req, res, next) => {
  const users = await User.find().select("-password -cart -token"); // Include createdAt by default

  if (!users || users.length === 0) {
    return next(new AppError("Users not found", 404));
  }

  res.json({
    status: httpStatusText.SUCCESS,
    data: { users },
  });
});

const register = asyncWrapper(async (req, res, next) => {
  const { firstName, lastName, email, password, role } = req.body;

  if (!firstName || !lastName || !email || !password) {
    return next(new AppError("All fields are required", 400));
  }

  const oldUser = await User.findOne({ email });
  if (oldUser) return next(new AppError("This user already exists", 400));

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = new User({
    firstName,
    lastName,
    email,
    password: hashedPassword,
    role,
  });

  const token = await generateJWT({
    email: newUser.email,
    id: newUser._id,
    role: newUser.role,
  });

  await newUser.save();

  const { password: pwd, ...userWithoutPass } = newUser.toObject();
  const userWithToken = { ...userWithoutPass, token };

  res.status(201).json({
    status: httpStatusText.SUCCESS,
    data: { user: userWithToken },
  });
});

const login = asyncWrapper(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError("Email and Password are required", 400));
  }

  const user = await User.findOne({ email });
  if (!user) return next(new AppError("Invalid Email or Password", 400));

  const matchedPass = await bcrypt.compare(password, user.password);
  if (!matchedPass) return next(new AppError("Invalid Email or Password", 400));

  const token = await generateJWT({
    id: user._id,
    email: user.email,
    role: user.role,
  });

  const { password: pwd, ...userWithoutPass } = user.toObject(); // remove password
  const userWithToken = { ...userWithoutPass, token }; // attach token inside user object

  res.json({
    status: httpStatusText.SUCCESS,
    data: { user: userWithToken },
  });
});

const addToCart = asyncWrapper(async (req, res, next) => {
  const { productId, quantity = 1 } = req.body;
  const userId = req.user.id;
  const user = await User.findById(userId).populate("cart.product");

  const existingProduct = user.cart.find((item) => {
    return item.product._id.toString() === productId;
  });

  if (existingProduct) {
    existingProduct.quantity += quantity;
  } else {
    const product = await Product.findById(productId);
    user.cart.push({ product: productId, quantity, price: product.price });
  }
  await user.save();
  await user.populate("cart.product");

  res.status(200).json({
    status: httpStatusText.SUCCESS,
    data: { cart: user.cart },
  });
});

const getCart = asyncWrapper(async (req, res, next) => {
  const userId = req.user.id;

  const user = await User.findById(userId).populate("cart.product");

  res
    .status(200)
    .json({ status: httpStatusText.SUCCESS, data: { cart: user.cart } });
});

const removeFromCart = asyncWrapper(async (req, res, next) => {
  const userId = req.user.id;
  const { productId } = req.params;

  const user = await User.findById(userId);

  const cartItemIndex = user.cart.findIndex(
    (item) => item.product.toString() === productId
  );

  if (cartItemIndex === -1) {
    return next(new AppError("Item not found in cart", 404));
  }

  user.cart.splice(cartItemIndex, 1);
  await user.save();

  res.status(200).json({
    status: httpStatusText.SUCCESS,
    message: "Item removed from cart",
    data: { cart: user.cart },
  });
});

const updateCartItem = asyncWrapper(async (req, res, next) => {
  const userId = req.user.id;
  const { productId } = req.params;
  const { quantity } = req.body;

  if (!quantity || quantity < 1) {
    return next(new AppError("Quantity must be at least 1", 400));
  }

  const user = await User.findById(userId);

  const cartItemIndex = user.cart.findIndex(
    (item) => item.product.toString() === productId
  );

  if (cartItemIndex === -1) {
    return next(new AppError("Item not found in cart", 404));
  }

  user.cart[cartItemIndex].quantity = quantity;
  await user.save();
  await user.populate("cart.product");

  res.status(200).json({
    status: httpStatusText.SUCCESS,
    data: { cart: user.cart },
  });
});

const getAllUsersAdmin = asyncWrapper(async (req, res, next) => {
  const users = await User.find({})
    .select("-password -cart -token")
    .sort({ createdAt: -1 })
    .limit(50);

  console.log(`✅ Dashboard: Found ${users.length} users`);

  res.json({
    status: httpStatusText.SUCCESS,
    data: { users },
  });
});

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getAllUser,
  getAllUsersAdmin,
  register,
  login,
  addToCart,
  getCart,
  removeFromCart,
  updateCartItem,
  getMe,
};
