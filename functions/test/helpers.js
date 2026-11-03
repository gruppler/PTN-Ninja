const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
const { initializeTestEnvironment } = require("@firebase/rules-unit-testing");

const PROJECT_ID = "demo-ptn-ninja";

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || PROJECT_ID;

function firestoreHostPort() {
  const [host, port] = (
    process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:4980"
  ).split(":");
  return { host, port: Number(port) };
}

function adminDb() {
  const app = admin.apps.length
    ? admin.app()
    : admin.initializeApp({ projectId: PROJECT_ID });
  return app.firestore();
}

function context(uid, { name, anonymous = false } = {}) {
  return {
    auth: {
      uid,
      token: {
        name,
        firebase: { sign_in_provider: anonymous ? "anonymous" : "password" },
      },
    },
  };
}

async function clearFirestore() {
  const { host, port } = firestoreHostPort();
  const res = await fetch(
    `http://${host}:${port}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: "DELETE" }
  );
  if (!res.ok) {
    throw new Error(`Failed to clear Firestore: ${res.status}`);
  }
}

function rulesEnv() {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      ...firestoreHostPort(),
      rules: fs.readFileSync(
        path.join(__dirname, "..", "..", "firestore.rules"),
        "utf8"
      ),
    },
  });
}

module.exports = { adminDb, context, clearFirestore, rulesEnv };
