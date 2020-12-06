"use strict";

const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const { TPStoCanvas } = require("./TPS-Ninja/src");

exports.tps = functions.https.onRequest((request, response) => {
  response.setHeader("Content-Type", "image/png");
  response.setHeader(
    "Content-Disposition",
    `attachment; filename="${request.query.name || "tps"}.png"`
  );
  TPStoCanvas(request.query)
    .pngStream()
    .pipe(response);
});
