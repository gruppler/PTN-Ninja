import config from "../../.firebase/config.js";
import * as firebase from "firebase/app";
import "firebase/auth";
import "firebase/firestore";
import "firebase/messaging";

let fb = firebase.initializeApp(config);

const auth = fb.auth();
const db = fb.firestore();
let messaging = null;

auth.useDeviceLanguage();
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(error => {
  console.error(error);
});

db.enablePersistence().catch(error => {
  console.error(error);
});

try {
  messaging = fb.messaging();
  messaging.usePublicVapidKey(config.vapidKey);
} catch (error) {
  console.error(error);
}

export { firebase, auth, db, messaging };

if (process.env.DEV) {
  window.auth = auth;
  window.db = db;
  window.messaging = messaging;
}
