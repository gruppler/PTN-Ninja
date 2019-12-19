import * as firebase from "firebase/app";

import "firebase/firestore";
import "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyC8NYcJAFKTLgHAwZggzgfYewvzLkwEmRc",
  authDomain: "ptn-ninja.firebaseapp.com",
  databaseURL: "https://ptn-ninja.firebaseio.com",
  projectId: "ptn-ninja",
  storageBucket: "ptn-ninja.appspot.com",
  messagingSenderId: "619201182321",
  appId: "1:619201182321:web:c1a7d037ddeb57329139d0"
};

let fb = firebase.initializeApp(firebaseConfig);

const db = fb.firestore();
let messaging = null;

try {
  messaging = fb.messaging();
  messaging.usePublicVapidKey(
    "BAIPE-P-zc77ZqHVQmGGPQZSP0PxIY8VWdR-qMbyVflFobz95_bjnMc9Qq-aNeoEpAwvznUXRPU2g9Y_rb1N_OM"
  );
} catch (error) {
  console.log(error);
}

export { db, messaging };
