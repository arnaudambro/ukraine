const express = require("express");
const router = express.Router();
const passport = require("passport");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { z } = require("zod");
const { catchErrors } = require("../errors");
const { validatePassword, obnjectIdRegex } = require("../utils");
const mailservice = require("../utils/mailservice");
const config = require("../config");
const { comparePassword } = require("../utils");
const UserModel = require("../models/user");

const EMAIL_OR_PASSWORD_INVALID = "EMAIL_OR_PASSWORD_INVALID";
const PASSWORD_NOT_VALIDATED = "PASSWORD_NOT_VALIDATED";

const passwordCheckError =
  "Le mot de passe n'est pas valide. Il doit comprendre 6 caractères, au moins une lettre, un chiffre et un caractère spécial";

const JWT_MAX_AGE = 60 * 60 * 3; // 3 hours in s
const COOKIE_MAX_AGE = JWT_MAX_AGE * 1000;

function cookieOptions() {
  if (config.ENVIRONMENT === "development" || config.ENVIRONMENT === "test") {
    return { maxAge: COOKIE_MAX_AGE, httpOnly: true, secure: true, sameSite: "None" };
  } else {
    return { maxAge: COOKIE_MAX_AGE, httpOnly: true, secure: true, domain: ".fabrique.social.gouv.fr", sameSite: "Lax" };
  }
}

function logoutCookieOptions() {
  if (config.ENVIRONMENT === "development" || config.ENVIRONMENT === "test") {
    return { httpOnly: true, secure: true, sameSite: "None" };
  } else {
    return { httpOnly: true, secure: true, domain: ".fabrique.social.gouv.fr", sameSite: "Lax" };
  }
}

router.get(
  "/me",
  passport.authenticate("user", { session: false }),
  catchErrors(async (req, res, next) => {
    return res.status(200).send({
      ok: true,
      user: req.user.userResponseModel(),
    });
  })
);

router.post(
  "/logout",
  passport.authenticate("user", { session: false }),
  catchErrors(async (_req, res) => {
    res.clearCookie("jwt", logoutCookieOptions());
    return res.status(200).send({ ok: true });
  })
);

router.post(
  "/signin",
  catchErrors(async (req, res, next) => {
    try {
      z.string().parse(req.body.password);
      z.string()
        .email()
        .parse((req.body.email || "").trim().toLowerCase());
    } catch (e) {
      const error = new Error(`Invalid request in signin: ${e}`);
      error.status = 400;
      return next(error);
    }

    let { password, email } = req.body;
    if (!password || !email) return res.status(400).send({ ok: false, error: "Missing password" });
    email = (email || "").trim().toLowerCase();

    const user = await UserModel.findOne({ email });
    if (!user) return res.status(403).send({ ok: false, error: "E-mail ou mot de passe incorrect", code: EMAIL_OR_PASSWORD_INVALID });

    const match = await comparePassword(password, user.password);
    if (!match) return res.status(403).send({ ok: false, error: "E-mail ou mot de passe incorrect", code: EMAIL_OR_PASSWORD_INVALID });
    user.lastLoginAt = new Date();

    await user.save();

    const token = jwt.sign({ _id: user._id }, config.SECRET, { expiresIn: JWT_MAX_AGE });
    res.cookie("jwt", token, cookieOptions());

    return res.status(200).send({ ok: true, token, user: user.userResponseModel() });
  })
);

router.get(
  "/signin-token",
  passport.authenticate("user", { session: false }),
  catchErrors(async (req, res, next) => {
    try {
      z.string().parse(req.cookies.jwt);
    } catch (e) {
      const error = new Error(`Invalid request in signin token: ${e}`);
      error.status = 400;
      return next(error);
    }

    return res.status(200).send({ ok: true, token, user: req.user.userResponseModel() });
  })
);

router.post(
  "/forgot_password",
  catchErrors(async ({ body: { email } }, res) => {
    try {
      z.string()
        .email()
        .parse((email || "").trim().toLowerCase());
    } catch (e) {
      const error = new Error(`Invalid request in forget password: ${e}`);
      error.status = 400;
      return next(error);
    }

    if (!email) return res.status(403).send({ ok: false, error: "Veuillez fournir un email", code: EMAIL_OR_PASSWORD_INVALID });

    const user = await UserModel.findOne({ email });
    if (!user) res.status(200).send({ ok: true });
    if (!user.password) res.status(200).send({ ok: true });

    const token = crypto.randomBytes(20).toString("hex");
    user.forgotPasswordResetToken = token;
    user.forgotPasswordResetExpires = new Date(Date.now() + JWT_MAX_AGE * 1000);

    const link = `${config.APP_URL}/auth/reset?token=${token}`;

    await user.save();

    const subject = "Réinitialiser votre mot de passe";
    const body = `Une requête pour réinitialiser votre mot de passe a été effectuée.
Si elle ne vient pas de vous, veuillez avertir l'administrateur.
Si vous en êtes à l'origine, vous pouvez cliquer sur ce lien: ${link}`;
    await mailservice.sendEmail(user.email, subject, body);

    return res.status(200).send({ ok: true });
  })
);

router.post(
  "/forgot_password_reset",
  catchErrors(async ({ body: { token, password } }, res) => {
    try {
      z.string().min(1).parse(token);
      z.string().min(1).parse(password);
    } catch (e) {
      const error = new Error(`Invalid request in forget password reset: ${e}`);
      error.status = 400;
      return next(error);
    }

    if (!validatePassword(password)) return res.status(400).send({ ok: false, error: passwordCheckError, code: PASSWORD_NOT_VALIDATED });
    const user = await UserModel.findOne({ forgotPasswordResetToken: token, forgotPasswordResetExpires: { $gte: new Date() } });

    if (!user) return res.status(400).send({ ok: false, error: "Le lien est non valide ou expiré" });
    user.set({
      password: password,
      forgotPasswordResetToken: null,
      forgotPasswordResetExpires: null,
    });
    await user.save();
    return res.status(200).send({ ok: true });
  })
);

router.post(
  "/",
  passport.authenticate("user", { session: false }),
  catchErrors(async (req, res, next) => {
    try {
      z.string().min(1).parse(req.body.name);
      z.optional(z.string().min(1)).parse(req.body.phone);
      z.string().email().parse(req.body.email);
      z.string().min(1).parse(req.body.newPassword);
      z.string().min(1).parse(req.body.verifyPassword);
    } catch (e) {
      const error = new Error(`Invalid request in user creation: ${e}`);
      error.status = 400;
      return next(error);
    }

    const { name, email, phone, password, verifyPassword } = req.body;

    if (password !== verifyPassword) return res.status(400).send({ ok: false, error: "Les mots de passe ne sont pas identiques" });
    if (!validatePassword(password)) return res.status(400).send({ ok: false, error: passwordCheckError, code: PASSWORD_NOT_VALIDATED });

    const newUser = {
      name,
      email: email.trim().toLowerCase(),
      phone: phone.trim().toLowerCase(),
      password,
    };

    const prevUser = await UserModel.findOne({ email: newUser.email });
    if (prevUser) return res.status(400).send({ ok: false, error: "A user already exists with this email" });

    const user = await UserModel.create(newUser);

    const token = jwt.sign({ _id: user._id }, config.SECRET, { expiresIn: JWT_MAX_AGE });
    res.cookie("jwt", token, cookieOptions());

    return res.status(200).send({
      ok: true,
      user: user.userResponseModel(),
    });
  })
);

router.post(
  "/reset_password",
  passport.authenticate("user", { session: false }),
  catchErrors(async (req, res, next) => {
    try {
      z.string().min(1).parse(req.body.password);
      z.string().min(1).parse(req.body.newPassword);
      z.string().min(1).parse(req.body.verifyPassword);
    } catch (e) {
      const error = new Error(`Invalid request in reset password: ${e}`);
      error.status = 400;
      return next(error);
    }
    const _id = req.user._id;
    const { password, newPassword, verifyPassword } = req.body;

    if (newPassword !== verifyPassword) return res.status(400).send({ ok: false, error: "Les mots de passe ne sont pas identiques" });
    if (!validatePassword(newPassword)) return res.status(400).send({ ok: false, error: passwordCheckError, code: PASSWORD_NOT_VALIDATED });

    const user = await UserModel.findById(_id);

    const auth = await comparePassword(password, user.password);
    if (!auth) return res.status(403).send({ ok: false, error: "Mot de passe incorrect", code: "Mot de passe incorrect" });

    user.set({ password: newPassword });
    await user.save();

    return res.status(200).send({
      ok: true,
      user: user.userResponseModel(),
    });
  })
);

router.put(
  "/",
  passport.authenticate("user", { session: false }),
  catchErrors(async (req, res, next) => {
    try {
      z.optional(z.string().min(1)).parse(req.body.name);
      z.optional(z.string().min(1)).parse(req.body.phone);
      z.string()
        .email()
        .optional()
        .or(z.literal(""))
        .parse((req.body.email || "").trim().toLowerCase());
      z.optional(z.string().min(1)).parse(req.body.password);
      if (req.body.termsAccepted) z.preprocess((input) => new Date(input), z.date()).parse(req.body.termsAccepted);
    } catch (e) {
      const error = new Error(`Invalid request in put user by id: ${e}`);
      error.status = 400;
      return next(error);
    }

    const _id = req.user._id;
    const { name, email, password, termsAccepted, phone } = req.body;

    const user = await UserModel.findById(_id);
    if (!user) return res.status(404).send({ ok: false, error: "Utilisateur non trouvé" });

    if (name) user.set({ name: name });
    if (phone) user.set({ phone: phone });
    if (email) user.set({ email: email.trim().toLowerCase() });
    if (termsAccepted) user.set({ termsAccepted: termsAccepted });
    if (password) {
      if (!validatePassword(password)) return res.status(400).send({ ok: false, error: passwordCheckError, code: PASSWORD_NOT_VALIDATED });
      user.set({ password: password });
    }

    await user.save();

    return res.status(200).send({
      ok: true,
      user: user.userResponseModel(),
    });
  })
);

router.delete(
  "/:_id",
  passport.authenticate("user", { session: false }),
  catchErrors(async (req, res, next) => {
    try {
      z.string().regex(obnjectIdRegex).parse(req.params._id);
    } catch (e) {
      const error = new Error(`Invalid request in delete user by id: ${e}`);
      error.status = 400;
      return next(error);
    }
    const userId = req.params._id;

    await UserModel.findByIdAndDelete(userId);
    res.status(200).send({ ok: true });
  })
);

module.exports = router;
