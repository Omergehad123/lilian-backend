const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../App/models/users.model");
const jwt = require("jsonwebtoken");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:
        "https://lilian-backend-7bjc.onrender.com/api/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      console.log("🔍 Google Profile:", profile.emails[0].value); // ← ADD THIS

      try {
        let user = await User.findOne({ email: profile.emails[0].value });

        if (!user) {
          console.log("✅ Creating new Google user"); // ← ADD THIS
          user = await User.create({
            firstName: profile.name.givenName,
            lastName: profile.name.familyName || "Google",
            email: profile.emails[0].value,
            password: "google-auth",
          });
        }

        const token = jwt.sign(
          { id: user._id, role: user.role },
          process.env.JWT_SECRET_KEY,
          { expiresIn: "7d" }
        );

        user.token = token;
        console.log("✅ Token generated:", token.slice(0, 20) + "..."); // ← ADD THIS

        return done(null, user);
      } catch (err) {
        console.error("❌ Passport error:", err); // ← ADD THIS
        return done(err, null);
      }
    }
  )
);

module.exports = passport;
