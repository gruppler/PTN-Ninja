import { db, messaging } from "../../boot/firebase.js";

export const NOTIFICATION_INIT = context => {
  if (!messaging || !Notification) {
    console.log("Messaging not supported");
  }

  context;

  Notification.requestPermission().then(permission => {
    if (permission === "granted") {
      // Get Instance ID token. Initially this makes a network call, once retrieved
      // subsequent calls to getToken will return from cache.
      messaging
        .getToken()
        .then(currentToken => {
          if (currentToken) {
            // sendTokenToServer(currentToken);
            // updateUIForPushEnabled(currentToken);
          } else {
            // Show permission request.
            console.log(
              "No Instance ID token available. Request permission to generate one."
            );
            // Show permission UI.
            // updateUIForPushPermissionRequired();
            // setTokenSentToServer(false);
          }
        })
        .catch(err => {
          console.log("An error occurred while retrieving token. ", err);
          // showToken("Error retrieving Instance ID token. ", err);
          // setTokenSentToServer(false);
        });

      // Callback fired if Instance ID token is updated.
      messaging.onTokenRefresh(() => {
        messaging
          .getToken()
          .then(refreshedToken => {
            console.log("Token refreshed.");
            // Indicate that the new Instance ID token has not yet been sent to the
            // app server.
            // setTokenSentToServer(false);
            // Send Instance ID token to app server.
            // sendTokenToServer(refreshedToken);
            refreshedToken;
          })
          .catch(err => {
            console.log("Unable to retrieve refreshed token ", err);
            // showToken("Unable to retrieve refreshed token ", err);
          });
      });
    } else {
      console.log("Unable to get permission to notify.");
    }
  });
};

export const CREATE = (context, game) => {
  context;
  game;

  db.collection("games")
    .add({
      name: game.name,
      state: game.minState
    })
    .then(docRef => {
      console.log("Document written with ID: ", docRef.id);
    })
    .catch(error => {
      console.error("Error adding document: ", error);
    });
};
