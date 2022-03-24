require("dotenv").config({ path: "./.env" });

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const logger = require("morgan");

const { PORT, CORS_ORIGIN_ALLOWED } = require("./config");
const errors = require("./errors");

// Put together a schema
const app = express();
if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
  app.use(logger("dev"));
}

app.use(cors({ credentials: true, origin: CORS_ORIGIN_ALLOWED }));

const now = new Date();
app.get("/", async (req, res) => {
  res.send(`Hello World at ${now.toISOString()}`);
});

// Pre middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "50mb" }));
app.use(helmet());
app.use(cookieParser());

// Routes

require("./passport")(app);

app.use("/user", require("./controllers/user"));

app.use(errors.sendError);

// Start the server
app.listen(PORT, () => console.log(`RUN ON PORT ${PORT}`));
