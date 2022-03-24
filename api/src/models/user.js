const mongoose = require("mongoose");
const dbConnection = require("../mongo");
const MODELNAME = "User";

const Schema = new mongoose.Schema(
  {
    /* profile */
    email: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      required: "Email address is required",
      match: [/^.+@(?:[\w-]+\.)+\w+$/, "Please fill a valid email address"],
    },
    phone: {
      type: String,
      trim: true,
      lowercase: true,
    },
    name: { type: String, index: "text" },
    password: { type: String },
    forgotPasswordResetToken: { type: String },
    forgotPasswordResetExpires: { type: Date },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

Schema.methods.userResponseModel = function () {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
  };
};

Schema.pre("save", function (next) {
  if (!this.isModified("password") && !this.isNew) return next();
  bcrypt.hash(this.password, 10, (_e, hash) => {
    this.password = hash;
    return next();
  });
});

const UserModel = dbConnection.models[MODELNAME] || dbConnection.model(MODELNAME, Schema);
module.exports = UserModel;
