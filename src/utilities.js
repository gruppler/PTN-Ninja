import { i18n } from "./boot/i18n";

export const formatError = (error) => {
  const errorMessages = i18n.messages[i18n.locale].error;
  if (typeof error === "string") {
    if (error in errorMessages) {
      return i18n.t(`error["${error}"]`);
    } else {
      return error;
    }
  } else {
    console.error(error);
    if ("code" in error && error.code in errorMessages) {
      return i18n.t(`error["${error.code}"]`);
    } else if ("message" in error) {
      if (error.message in errorMessages) {
        return i18n.t(`error["${error.message}"]`);
      } else {
        return error.message;
      }
    }
  }
};

export const formatSuccess = (success) => {
  const successMessages = i18n.messages[i18n.locale].success;
  if (typeof success === "string") {
    if (success in successMessages) {
      return i18n.t(`success["${success}"]`);
    } else {
      return success;
    }
  }
};

export const formatWarning = (warning) => {
  const warningMessages = i18n.messages[i18n.locale].warning;
  if (typeof warning === "string") {
    if (warning in warningMessages) {
      return i18n.t(`warning["${warning}"]`);
    } else {
      return warning;
    }
  }
};

export const formatHint = (hint) => {
  const warningMessages = i18n.messages[i18n.locale].hint;
  if (typeof hint === "string") {
    if (hint in warningMessages) {
      return i18n.t(`hint["${hint}"]`);
    } else {
      return hint;
    }
  }
};
