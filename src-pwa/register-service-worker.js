import { i18n } from "../src/boot/i18n";
import { Notify, openURL } from "quasar";
import { register } from "register-service-worker";
import store from "../src/store";

// The ready(), registered(), cached(), updatefound() and updated()
// events passes a ServiceWorkerRegistration instance in their arguments.
// ServiceWorkerRegistration: https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration

register(process.env.SERVICE_WORKER_FILE, {
  // The registrationOptions object will be passed as the second argument
  // to ServiceWorkerContainer.register()
  // https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register#Parameter

  // registrationOptions: { scope: './' },

  ready() {
    if (process.env.DEV) {
      console.log("App is being served from cache by a service worker.");
    }
  },

  registered(/* registration */) {
    if (process.env.DEV) {
      console.log("Service worker has been registered.");
    }
  },

  cached(/* registration */) {
    if (process.env.DEV) {
      console.log("Content has been cached for offline use.");
    }
  },

  updatefound(/* registration */) {
    if (process.env.DEV) {
      console.log("New content is downloading.");
    }
  },

  updated(/* registration */) {
    if (!process.env.DEV) {
      Notify.create({
        message: i18n.t("success.updateAvailable"),
        icon: "update",
        color: "accent",
        textColor: store.state.theme.accentDark ? "textLight" : "textDark",
        position: "bottom",
        timeout: 0,
        actions: [
          {
            label: i18n.t("Update"),
            color: "primary",
            handler: () => {
              window.location.reload();
            },
          },
          {
            label: i18n.t("Changelog"),
            color: "primary",
            handler: () => {
              openURL("https://github.com/gruppler/PTN-Ninja/releases");
              window.location.reload();
            },
          },
        ],
      });
    }
  },

  offline() {
    if (process.env.DEV) {
      console.log(
        "No internet connection found. App is running in offline mode."
      );
    }
  },

  error(err) {
    if (process.env.DEV) {
      console.error("Error during service worker registration:", err);
    }
  },
});
