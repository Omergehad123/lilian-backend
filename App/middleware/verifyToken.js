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
    req.user = currentUser;
    next();
  } catch (err) {
    return res.status(401).json("Invalid token");
  }
};

module.exports = verifyToken;
