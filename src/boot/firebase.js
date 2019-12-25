import config from "../../.firebase/config.js";
import * as firebase from "firebase/app";
import "firebase/firestore";
import "firebase/messaging";

let fb = firebase.initializeApp(config);

const db = fb.firestore();
let messaging = null;

db.enablePersistence().catch(error => {
  console.error(error);
});

try {
  messaging = fb.messaging();
  messaging.usePublicVapidKey(config.vapidKey);
} catch (error) {
  console.error(error);
}

export { db, messaging };

if (process.env.DEV) {
  window.db = db;
  window.messaging = messaging;
}
