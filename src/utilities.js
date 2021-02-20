import { i18n } from "./boot/i18n";
import { toDate } from "date-fns";
import { isString } from "lodash";

export const formatError = (error) => {
  const errorMessages = i18n.messages[i18n.locale].error;
  if (isString(error)) {
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
  if (isString(success)) {
    if (success in successMessages) {
      return i18n.t(`success["${success}"]`);
    } else {
      return success;
    }
  }
};

export const formatWarning = (warning) => {
  const warningMessages = i18n.messages[i18n.locale].warning;
  if (isString(warning)) {
    if (warning in warningMessages) {
      return i18n.t(`warning["${warning}"]`);
    } else {
      return warning;
    }
  }
};

export const formatHint = (hint) => {
  const warningMessages = i18n.messages[i18n.locale].hint;
  if (isString(hint)) {
    if (hint in warningMessages) {
      return i18n.t(`hint["${hint}"]`);
    } else {
      return hint;
    }
  }
};

export const timestampToDate = (date) => {
  if (date && date.constructor !== Date) {
    if (date.toDate) {
      date = date.toDate(date);
    } else if (date instanceof Object && "_nanoseconds" in date) {
      date = new Date(date._seconds * 1e3 + date._nanoseconds / 1e6);
    } else {
      date = new Date(date);
      if (isNaN(date)) {
        date = toDate(date);
      }
    }
  }
  return date;
};
