const jwt = require("jsonwebtoken");

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];

    if (!authHeader) {
      return res.status(401).json("Token is required");
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json("Token not found");
    }

    const currentUser = jwt.verify(token, process.env.JWT_SECRET_KEY);

    // ✅ FIX: Ensure req.user has _id property
    req.user = {
      _id: currentUser.id || currentUser._id,
    };

    console.log("DECODED:", currentUser);
    console.log("REQ.USER:", req.user);
    console.log("USER ID:", req.user._id);

    next();
  } catch (err) {
    return res.status(401).json("Invalid token");
  }
};

module.exports = verifyToken;
