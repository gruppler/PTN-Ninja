"use strict";

const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const { TPStoCanvas } = require("./TPS-Ninja/src");

exports.tps = functions.https.onRequest((request, response) => {
  try {
    const canvas = TPStoCanvas(request.query);
    let name = request.query.name || canvas.id.replace(/\//g, "-");
    if (!name.endsWith(".png")) {
      name += ".png";
    }
    response.setHeader("Content-Type", "image/png");
    response.setHeader("Content-Disposition", `attachment; filename="${name}"`);
    canvas.pngStream().pipe(response);
  } catch (error) {
    response.status(400).send({ message: error.message });
    console.error(error);
  }
});
