import {
  prompt,
  notify,
  notifyError,
  notifySuccess,
  notifyWarning,
  notifyHint,
  notifyUndo,
} from "../utilities";

export default ({ Vue }) => {
  Vue.prototype.prompt = prompt;
  Vue.prototype.notify = notify;
  Vue.prototype.notifyError = notifyError;
  Vue.prototype.notifySuccess = notifySuccess;
  Vue.prototype.notifyWarning = notifyWarning;
  Vue.prototype.notifyHint = notifyHint;
  Vue.prototype.notifyUndo = notifyUndo;

  // Open the Settings dialog at a category, and optionally a section.
  // Embeds don't expose the Settings dialog.
  Vue.prototype.$openSettings = function (category, section) {
    if (this.$store.state.ui.embed) {
      return;
    }
    this.$router.push({ name: "settings", params: { category, section } });
  };
};
