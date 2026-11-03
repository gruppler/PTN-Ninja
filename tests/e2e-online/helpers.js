// @ts-check
/**
 * Helpers for online-play E2E specs. Assumes the Firebase emulators
 * (`yarn emulate`) and the dev server are running.
 */
const AUTH = "http://localhost:9199";
const FIRESTORE = "http://localhost:4989";
const PROJECT = "ptn-ninja";

let counter = 0;

async function post(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (!response.ok) {
    throw new Error(`${url}: ${JSON.stringify(json)}`);
  }
  return json;
}

/** Create a registered account with a display name and a names/{name} doc */
async function createAccount(name) {
  const email = `${name.toLowerCase()}-${Date.now()}-${counter++}@example.com`;
  const password = "password123";
  const key = "key=fake-api-key";
  const { idToken, localId } = await post(
    `${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?${key}`,
    { email, password, returnSecureToken: true }
  );
  await post(
    `${AUTH}/identitytoolkit.googleapis.com/v1/accounts:update?${key}`,
    {
      idToken,
      displayName: name,
    }
  );
  const response = await fetch(
    `${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/names/${encodeURIComponent(
      name.toLowerCase()
    )}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer owner",
      },
      body: JSON.stringify({ fields: { uid: { stringValue: localId } } }),
    }
  );
  if (!response.ok) {
    throw new Error(`names write failed: ${await response.text()}`);
  }
  return { email, password, uid: localId };
}

/** Open the app and wait for the store and the online user */
async function openApp(page) {
  await page.goto("/");
  await page.waitForFunction(
    () =>
      window.app &&
      window.app.$store &&
      window.app.$store.state.online &&
      window.app.$store.state.online.initialized &&
      window.app.$store.state.online.user,
    null,
    { timeout: 30000 }
  );
}

/** Sign the page in with an account from createAccount */
async function signIn(page, account) {
  await openApp(page);
  await page.evaluate(
    ({ email, password }) =>
      window.auth.signInWithEmailAndPassword(email, password),
    account
  );
  await page.waitForFunction(
    (uid) => {
      const user = window.app.$store.state.online.user;
      return user && user.uid === uid;
    },
    account.uid,
    { timeout: 15000 }
  );
}

/** Open the app as an anonymous guest and return their uid */
async function signInAsGuest(page) {
  await openApp(page);
  return page.evaluate(() => window.app.$store.state.online.user.uid);
}

module.exports = {
  createAccount,
  openApp,
  signIn,
  signInAsGuest,
  AUTH,
  FIRESTORE,
  PROJECT,
};
