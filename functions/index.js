"use strict";

const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const asyncPool = require("tiny-async-pool");

const { TPStoPNG } = require("./TPStoPNG");

exports.tps = functions.https.onRequest((request, response) => {
  response.setHeader("Content-Type", "image/png");
  TPStoPNG(request.query)
    .pngStream()
    .pipe(response);
});

exports.accountcleanup = functions.pubsub
  .schedule("every day 00:00")
  .onRun(async context => {
    const MAX_CONCURRENT = 5;
    // Fetch all user details.
    const inactiveUsers = await getInactiveUsers();
    await asyncPool(MAX_CONCURRENT, inactiveUsers, deleteInactiveUser);
    console.log("User cleanup finished");
  });

function deleteInactiveUser(inactiveUsers) {
  if (inactiveUsers.length > 0) {
    const userToDelete = inactiveUsers.pop();
    return admin
      .firestore()
      .collection("games")
      .where("config.players", "array-contains", userToDelete.uid)
      .get()
      .then(games => {
        if (games.size === 0) {
          // Delete the inactive user.
          return admin
            .auth()
            .deleteUser(userToDelete.uid)
            .then(() => {
              return console.log(
                "Deleted user account",
                userToDelete.uid,
                "because of inactivity"
              );
            })
            .catch(error => {
              return console.error(
                "Deletion of inactive user account",
                userToDelete.uid,
                "failed:",
                error
              );
            });
        }
      })
      .catch(error => {
        return console.error(
          `Checking games for user ${userToDelete.uid} failed:`,
          error
        );
      });
  } else {
    return null;
  }
}

async function getInactiveUsers(users = [], nextPageToken) {
  const result = await admin.auth().listUsers(1000, nextPageToken);
  // Find users that have not signed in in the last 30 days.
  const inactiveUsers = result.users.filter(user => {
    return (
      !user.emailVerified &&
      Date.parse(user.metadata.lastSignInTime) <
        Date.now() - 21 * 24 * 60 * 60 * 1000
    );
  });

  // Concat with list of previously found inactive users if there was more than 1000 users.
  users = users.concat(inactiveUsers);

  // If there are more users to fetch we fetch them.
  if (result.pageToken) {
    return getInactiveUsers(users, result.pageToken);
  }

  return users;
}
