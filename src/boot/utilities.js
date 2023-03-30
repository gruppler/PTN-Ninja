import {
  prompt,
  notify,
  notifyError,
  notifySuccess,
  notifyWarning,
  notifyHint,
} from "../utilities";

export default ({ Vue }) => {
  Vue.prototype.prompt = prompt;
  Vue.prototype.notify = notify;
  Vue.prototype.notifyError = notifyError;
  Vue.prototype.notifySuccess = notifySuccess;
  Vue.prototype.notifyWarning = notifyWarning;
  Vue.prototype.notifyHint = notifyHint;
};
