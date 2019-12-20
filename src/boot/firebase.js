import config from "../../.firebase/config.js";
import * as firebase from "firebase/app";
import "firebase/firestore";
import "firebase/messaging";

let fb = firebase.initializeApp(config);

const db = fb.firestore();
let messaging = null;

try {
  messaging = fb.messaging();
  messaging.usePublicVapidKey(config.vapidKey);
} catch (error) {
  console.log(error);
}

export { db, messaging };
