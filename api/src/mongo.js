const mongoose = require("mongoose");
const { MONGODB_ADDON_URI, MONGODB_DB_NAME } = require("./config");

const dbConnection = mongoose.createConnection(MONGODB_ADDON_URI);

dbConnection.on("error", console.error.bind(console, `MongoDB ${MONGODB_DB_NAME} connection error:`));

dbConnection.once("open", async () => {
  console.log("\x1b[1m%s\x1b[0m", `${MONGODB_DB_NAME} connected`);
});

module.exports = dbConnection;
