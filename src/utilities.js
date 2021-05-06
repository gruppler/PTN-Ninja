import { i18n } from "./boot/i18n";
import { isString } from "lodash";

export const formatError = (error) => {
  if (isString(error)) {
    if (i18n.te(`error["${error}"]`)) {
      return i18n.t(`error["${error}"]`);
    } else {
      return error;
    }
  } else {
    console.error(error);
    if (i18n.te(`error["${error.code}"]`)) {
      return i18n.t(`error["${error.code}"]`);
    } else if ("message" in error) {
      if (i18n.te(`error["${error.message}"]`)) {
        return i18n.t(`error["${error.message}"]`);
      } else {
        return error.message;
      }
    }
  }
};

export const formatSuccess = (success) => {
  if (isString(success)) {
    if (i18n.te(`success["${success}"]`)) {
      return i18n.t(`success["${success}"]`);
    } else {
      return success;
    }
  }
};

export const formatWarning = (warning) => {
  if (isString(warning)) {
    if (i18n.te(`warning["${warning}"]`)) {
      return i18n.t(`warning["${warning}"]`);
    } else {
      return warning;
    }
  } else {
    if (i18n.te(`warning["${warning.code}"]`)) {
      return i18n.t(`warning["${warning.code}"]`);
    } else if ("message" in warning) {
      if (i18n.te(`warning["${warning.message}"]`)) {
        return i18n.t(`warning["${warning.message}"]`);
      } else {
        return warning.message;
      }
    }
  }
};

export const formatHint = (hint) => {
  if (isString(hint)) {
    if (i18n.te(`hint["${hint}"]`)) {
      return i18n.t(`hint["${hint}"]`);
    } else {
      return hint;
    }
  }
};
