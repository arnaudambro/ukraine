const express = require("express");
const router = express.Router();
const passport = require("passport");
const { z } = require("zod");
const { catchErrors } = require("../errors");
const { obnjectIdRegex } = require("../utils");
const CollectModel = require("../models/collect");

router.get(
  "/",
  passport.authenticate("user", { session: false }),
  catchErrors(async (req, res) => {
    const query = {};

    if (req.query.hasOwnProperty("userId")) query.user = req.query.userId;
    if (req.query.hasOwnProperty("minDate")) query.date = { $gte: req.query.minDate };
    if (req.query.hasOwnProperty("maxDate")) query.date = { $lte: req.query.minDate };
    if (req.query.hasOwnProperty("status")) query.status = { $in: req.query.status }; // array
    if (req.query.hasOwnProperty("coordinates")) {
      query.pickupGeometry = {
        $near: {
          $geometry: { type: "Point", coordinates: req.user.coordinates }, // [longitude, latitude]
          $maxDistance: 3000, // get the max distance from the map instead
          $minDistance: 0,
        },
      };
    }

    const convoys = await CollectModel.find(query).populate("user convoy");
    return res.status(200).send({ ok: true, data: convoys });
  })
);

router.get(
  "/:_id",
  passport.authenticate("user", { session: false }),
  catchErrors(async (req, res) => {
    try {
      z.string().regex(obnjectIdRegex).parse(req.params._id);
    } catch (e) {
      const error = new Error(`Invalid request in delete user by _id: ${e}`);
      error.status = 400;
      return next(error);
    }
    const existingCollect = await CollectModel.findById(req.params._id).populate("user convoy");
    if (!existingCollect) return res.status(400).send({ ok: false, error: "Convoy not existing" });

    return res.status(200).send({ ok: true, data: existingCollect });
  })
);

router.post(
  "/",
  passport.authenticate("user", { session: false }),
  catchErrors(async (req, res, next) => {
    const newCollect = {};

    if (req.body.hasOwnProperty("departure")) newCollect.departure = req.body.departure;
    if (req.body.hasOwnProperty("pickupName")) newCollect.pickupName = req.body.pickupName;
    if (req.body.hasOwnProperty("pickupGeometry")) newCollect.pickupGeometry = req.body.pickupGeometry;
    if (req.body.hasOwnProperty("loadingVolume")) newCollect.loadingVolume = req.body.loadingVolume;
    if (req.body.hasOwnProperty("user")) newCollect.user = req.body.user;
    if (req.body.hasOwnProperty("convoy")) newCollect.convoy = req.body.convoy;
    if (req.body.hasOwnProperty("whatsappLink")) newCollect.whatsappLink = req.body.whatsappLink;
    if (req.body.hasOwnProperty("status")) newCollect.status = req.body.status;

    const collect = await CollectModel.create(newCollect).populate("user convoy");

    return res.status(200).send({
      ok: true,
      data: collect,
    });
  })
);

router.put(
  "/:_id",
  passport.authenticate("user", { session: false }),
  catchErrors(async (req, res, next) => {
    try {
      z.string().regex(obnjectIdRegex).parse(req.params._id);
    } catch (e) {
      const error = new Error(`Invalid request in delete user by _id: ${e}`);
      error.status = 400;
      return next(error);
    }
    const existingCollect = await CollectModel.findById(req.params._id);
    if (!existingCollect) return res.status(400).send({ ok: false, error: "Convoy not existing" });

    const updatedCollect = {};

    if (req.body.hasOwnProperty("departure")) updatedCollect.departure = req.body.departure;
    if (req.body.hasOwnProperty("pickupName")) updatedCollect.pickupName = req.body.pickupName;
    if (req.body.hasOwnProperty("pickupGeometry")) updatedCollect.pickupGeometry = req.body.pickupGeometry;
    if (req.body.hasOwnProperty("loadingVolume")) updatedCollect.loadingVolume = req.body.loadingVolume;
    if (req.body.hasOwnProperty("user")) updatedCollect.user = req.body.user;
    if (req.body.hasOwnProperty("convoy")) updatedCollect.convoy = req.body.convoy;
    if (req.body.hasOwnProperty("whatsappLink")) updatedCollect.whatsappLink = req.body.whatsappLink;
    if (req.body.hasOwnProperty("status")) updatedCollect.status = req.body.status;

    existingCollect.set(updatedCollect);
    await existingCollect.save();

    const collect = await CollectModel.findById(req.params._id).populate("user convoy");

    return res.status(200).send({
      ok: true,
      data: collect,
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
      const error = new Error(`Invalid request in delete collect by _id: ${e}`);
      error.status = 400;
      return next(error);
    }
    const userId = req.params._id;

    await CollectModel.findByIdAndDelete(userId);
    res.status(200).send({ ok: true });
  })
);

module.exports = router;
