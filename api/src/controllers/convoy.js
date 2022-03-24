const express = require("express");
const router = express.Router();
const passport = require("passport");
const { z } = require("zod");
const { catchErrors } = require("../errors");
const { obnjectIdRegex } = require("../utils");
const ConvoyModel = require("../models/convoy");

router.get(
  "/",
  passport.authenticate("user", { session: false }),
  catchErrors(async (req, res) => {
    const query = {};

    if (req.query.hasOwnProperty("driverId")) query.driver = req.query.driverId;
    if (req.query.hasOwnProperty("minDate")) query.departure = { $gte: req.query.minDate };
    if (req.query.hasOwnProperty("maxDate")) query.departure = { $lte: req.query.minDate };
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

    const convoys = await ConvoyModel.find(query).populate("driver");
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
    const existingConvoy = await ConvoyModel.findById(req.params._id).populate("driver");
    if (!existingConvoy) return res.status(400).send({ ok: false, error: "Convoy not existing" });

    return res.status(200).send({ ok: true, data: existingConvoy });
  })
);

router.post(
  "/",
  passport.authenticate("user", { session: false }),
  catchErrors(async (req, res, next) => {
    const newConvoy = {};

    if (req.body.hasOwnProperty("departure")) newConvoy.departure = req.body.departure;
    if (req.body.hasOwnProperty("pickupName")) newConvoy.pickupName = req.body.pickupName;
    if (req.body.hasOwnProperty("pickupGeometry")) newConvoy.pickupGeometry = req.body.pickupGeometry;
    if (req.body.hasOwnProperty("dropoffName")) newConvoy.dropoffName = req.body.dropoffName;
    if (req.body.hasOwnProperty("dropoffGeometry")) newConvoy.dropoffGeometry = req.body.dropoffGeometry;
    if (req.body.hasOwnProperty("placesInCar")) newConvoy.placesInCar = req.body.placesInCar;
    if (req.body.hasOwnProperty("loadingVolume")) newConvoy.loadingVolume = req.body.loadingVolume;
    if (req.body.hasOwnProperty("driver")) newConvoy.driver = req.body.driver;
    if (req.body.hasOwnProperty("whatsappLink")) newConvoy.whatsappLink = req.body.whatsappLink;
    if (req.body.hasOwnProperty("status")) newConvoy.status = req.body.status;

    const convoy = await ConvoyModel.create(newConvoy).populate("driver");

    return res.status(200).send({
      ok: true,
      data: convoy,
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
    const existingConvoy = await ConvoyModel.findById(req.params._id);
    if (!existingConvoy) return res.status(400).send({ ok: false, error: "Convoy not existing" });

    const updatedConvoy = {};

    if (req.body.hasOwnProperty("departure")) updatedConvoy.departure = req.body.departure;
    if (req.body.hasOwnProperty("pickupName")) updatedConvoy.pickupName = req.body.pickupName;
    if (req.body.hasOwnProperty("pickupGeometry")) updatedConvoy.pickupGeometry = req.body.pickupGeometry;
    if (req.body.hasOwnProperty("dropoffName")) updatedConvoy.dropoffName = req.body.dropoffName;
    if (req.body.hasOwnProperty("dropoffGeometry")) updatedConvoy.dropoffGeometry = req.body.dropoffGeometry;
    if (req.body.hasOwnProperty("placesInCar")) updatedConvoy.placesInCar = req.body.placesInCar;
    if (req.body.hasOwnProperty("loadingVolume")) updatedConvoy.loadingVolume = req.body.loadingVolume;
    if (req.body.hasOwnProperty("driver")) updatedConvoy.driver = req.body.driver;
    if (req.body.hasOwnProperty("whatsappLink")) updatedConvoy.whatsappLink = req.body.whatsappLink;
    if (req.body.hasOwnProperty("status")) updatedConvoy.status = req.body.status;

    existingConvoy.set(updatedConvoy);
    await existingConvoy.save();

    const convoy = await ConvoyModel.findById(req.params._id).populate("driver");

    return res.status(200).send({
      ok: true,
      data: convoy,
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
      const error = new Error(`Invalid request in delete convoy by _id: ${e}`);
      error.status = 400;
      return next(error);
    }
    const userId = req.params._id;

    await ConvoyModel.findByIdAndDelete(userId);
    res.status(200).send({ ok: true });
  })
);

module.exports = router;
