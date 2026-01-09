const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../App/models/users.model");
const jwt = require("jsonwebtoken");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/api/auth/google/callback", // Must match Google Console exactly
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ email: profile.emails[0].value });

        if (!user) {
          user = await User.create({
            firstName: profile.name.givenName,
            lastName: profile.name.familyName || "Google",
            email: profile.emails[0].value,
            password: "google-auth", // Not used
          });
        }

        const token = jwt.sign(
          { id: user._id, role: user.role },
          process.env.JWT_SECRET_KEY,
          { expiresIn: "7d" }
        );

        // ✅ CRITICAL: Attach token to user object (matches regular login structure)
        user.token = token;

        return done(null, user); // ✅ Just user (with token attached)
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

module.exports = passport;
