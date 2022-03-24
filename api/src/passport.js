const passport = require("passport");
const JwtStrategy = require("passport-jwt").Strategy;
const { SECRET } = require("./config");
const UserModel = require("./models/user"); // load up the user model

module.exports = (app) => {
  const jwtStrategyOptions = {
    jwtFromRequest: (req) => req.cookies.jwt,
    secretOrKey: SECRET,
  };

  passport.use(
    "user",
    new JwtStrategy(jwtStrategyOptions, async function (jwt, done) {
      try {
        const { _id } = jwt;
        const user = await UserModel.findById(_id);
        if (user) return done(null, user);
      } catch (e) {
        console.log("error passport", e);
      }
      return done(null, false);
    })
  );

  app.use(passport.initialize());
};
