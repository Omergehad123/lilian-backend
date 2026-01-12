const express = require("express");
const router = express.Router();
const userController = require("../App/controllers/usersController");
const verifyToken = require("../App/middleware/verifyToken");

router.get("/", verifyToken, userController.getAllUser);

router.get("/admin", verifyToken, userController.getAllUsersAdmin);

router.post("/login", userController.login);

router.post("/register", userController.register);

router.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  res.json({ message: "Logged out successfully" });
});

router.post("/cart", verifyToken, userController.addToCart);

router.get("/cart", verifyToken, userController.getCart);

router.delete("/cart/:productId", verifyToken, userController.removeFromCart);

router.patch("/cart/:productId", verifyToken, userController.updateCartItem);

router.get("/me", verifyToken, userController.getMe);

// ✅ ADD THIS NEW ROUTE at the top (before other routes)
router.post("/guest", async (req, res) => {
  try {
    const { v4: uuidv4 } = require("uuid");

    const guestId = `guest_${uuidv4().slice(0, 8)}`;
    const guestEmail = `${guestId}@guests.lilian.com`;

    let user = await User.findOne({
      $or: [{ guestId }, { email: guestEmail }],
    });

    if (!user) {
      user = new User({
        firstName: "Guest",
        lastName: "",
        email: guestEmail,
        password: null, // no password
        isGuest: true,
        guestId: guestId,
        role: userRoles.USER, // use your roles constant
        cart: [],
      });
      await user.save();
    }

    const token = await generateJWT({
      id: user._id,
      email: user.email,
      role: user.role,
      isGuest: true,
    });

    const { password: pwd, ...userWithoutPass } = user.toObject();
    const userWithToken = { ...userWithoutPass, token };

    res.json({
      status: httpStatusText.SUCCESS,
      data: { user: userWithToken },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Guest login failed",
    });
  }
});

module.exports = router;
