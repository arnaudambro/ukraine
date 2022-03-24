const mongoose = require("mongoose");
const dbConnection = require("../mongo");
const MODELNAME = "Convoy";

const locationSchema = new mongoose.Schema({
  type: {
    type: String, // Don't do `{ location: { type: String } }`
    enum: ["Point"], // 'location.type' must be 'Point'
    required: true,
    default: "Point",
  },
  coordinates: {
    type: [Number], // [longitude, latitude]
    required: true,
  },
});

const Schema = new mongoose.Schema(
  {
    departure: Date,
    pickupName: String,
    pickupGeometry: {
      type: locationSchema,
      index: "2dsphere",
    },
    dropoffName: String,
    dropoffGeometry: {
      type: locationSchema,
      index: "2dsphere",
    },
    placesInCar: Number,
    loadingVolume: String,

    driver: { type: mongoose.Types.ObjectId, ref: "user" },
    whatsappLink: String,
    status: { type: String, enum: ["preparation", "loaded", "processing", "delivered"] },
  },
  { timestamps: true }
);

const ConvoiModel = dbConnection.models[MODELNAME] || dbConnection.model(MODELNAME, Schema);
module.exports = ConvoiModel;
