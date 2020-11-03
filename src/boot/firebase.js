import config from "../../.firebase/config.js";
import * as firebase from "firebase/app";
import "firebase/auth";
import "firebase/firestore";
import "firebase/functions";
import "firebase/messaging";

firebase.initializeApp(config);

const auth = firebase.auth();
const db = firebase.firestore();
const functions = firebase.functions();
let messaging = null;

try {
  messaging = firebase.messaging();
  messaging.usePublicVapidKey(config.vapidKey);
} catch (error) {
  console.error(error);
}

auth.useDeviceLanguage();
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(error => {
  console.error(error);
});

db.enablePersistence({ synchronizeTabs: true }).catch(error => {
  console.error(error);
});

export { firebase, auth, db, functions, messaging };

if (process.env.DEV) {
  window.auth = auth;
  window.db = db;
  window.messaging = messaging;
}
