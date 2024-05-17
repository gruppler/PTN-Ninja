import TPS from "./TPS";
import Result from "./Result";

import { padStart } from "lodash";
import { parse, parseISO } from "date-fns";

export const KOMI_MIN = -20.5;
export const KOMI_MAX = 20.5;

const capitalized = {
  caps: "Caps",
  caps1: "Caps1",
  caps2: "Caps2",
  flats: "Flats",
  flats1: "Flats1",
  flats2: "Flats2",
  clock: "Clock",
  date: "Date",
  event: "Event",
  komi: "Komi",
  opening: "Opening",
  player1: "Player1",
  player2: "Player2",
  points: "Points",
  rating1: "Rating1",
  rating2: "Rating2",
  result: "Result",
  round: "Round",
  site: "Site",
  size: "Size",
  time: "Time",
  tps: "TPS",
};

export const formats = {
  caps: /^\d+$/,
  caps1: /^\d+$/,
  caps2: /^\d+$/,
  flats: /^\d+$/,
  flats1: /^\d+$/,
  flats2: /^\d+$/,
  clock:
    /^\d+min(\+\d+sec)$|^((((\d\s+)?\d\d?:)?\d\d?:)?\d\d?\s*)?(\+(((\d\s+)?\d\d?:)?\d\d?:)?\d\d?)?$/,
  date: /^\d{4}\.\d\d?\.\d\d?$/,
  event: /^[^"]+$/,
  komi: /^-?\d*(\.5)?$/,
  opening: /^swap|no-swap$/i,
  player1: /^[^"{}]+$/,
  player2: /^[^"{}]+$/,
  points: /^\d+$/,
  rating1: /^\d+$/,
  rating2: /^\d+$/,
  result: /^(R-0|0-R|F-0|0-F|1-0|0-1|1\/2-1\/2|1\/2)$/,
  round: /^\d+$/,
  site: /^[^"]+$/,
  size: /^[3-8]$/,
  time: /^\d\d(:\d\d){1,2}$/,
  tps: /^[1-8xSC/,]+\s+[1,2]\s+\d+$/i,
};

export const now = () => {
  const now = new Date();
  return {
    date: dateFromDate(now),
    time: timeFromDate(now),
  };
};

export const fromDate = (date) => {
  return {
    date: dateFromDate(date),
    time: timeFromDate(date),
  };
};

export const dateFromDate = (date, localTime = false) => {
  let year, month, day;
  if (localTime) {
    year = date.getFullYear();
    month = date.getMonth() + 1;
    day = date.getDate();
  } else {
    year = date.getUTCFullYear();
    month = date.getUTCMonth() + 1;
    day = date.getUTCDate();
  }
  return `${year}.${padStart(month, 2, "0")}.${padStart(day, 2, "0")}`;
};

export const timeFromDate = (date, localTime = false) => {
  let hours, minutes, seconds;
  if (localTime) {
    hours = date.getHours();
    minutes = date.getMinutes();
    seconds = date.getSeconds();
  } else {
    hours = date.getUTCHours();
    minutes = date.getUTCMinutes();
    seconds = date.getUTCSeconds();
  }
  return (
    padStart(hours, 2, "0") +
    ":" +
    padStart(minutes, 2, "0") +
    ":" +
    padStart(seconds, 2, "0")
  );
};

export const toDate = (date, time = "", localTime = false) => {
  if (date) {
    if (date.seconds) {
      return new Date(date.seconds * 1e3);
    } else {
      if (localTime) {
        return parse(
          `${date} ${time || "00:00:00"}`,
          "yyyy.MM.dd HH:mm:ss",
          new Date()
        );
      } else {
        date = date.replace(/\./g, "-");
        if (time) {
          date += ` ${time}Z`;
        }
        return parseISO(date);
      }
    }
  }
  return null;
};

export default class Tag {
  constructor(notation, key, value) {
    if (notation) {
      const matchData = notation.match(/\[([^\s]+)\s*"([^"]*)"\]/);

      if (!matchData) {
        throw new Error("Invalid tag");
      }

      [this.ptn, this.key, this.value] = matchData;
      key = this.key.toLowerCase();
      this.key = capitalized[key];
    } else if (key) {
      this.key = capitalized[key.toLowerCase()];
      this.value = value;
    }

    if (this.value === "?") {
      this.value = "";
    }

    if (key in formats) {
      if (this.value && !formats[key].test(this.value)) {
        throw new Error("Invalid " + key);
      }
    } else {
      throw new Error("Unrecognized tag");
    }

    switch (key) {
      case "caps":
      case "caps1":
      case "caps2":
      case "flats":
      case "flats1":
      case "flats2":
        this.value = Number(this.value);
        break;
      case "komi":
        this.value = Number(this.value);
        if (this.value % 1) {
          this.value =
            this.value < 0
              ? Math.ceil(this.value) - 0.5
              : Math.floor(this.value) + 0.5;
          this.value = Math.max(KOMI_MIN, Math.min(KOMI_MAX, this.value));
        }
        break;
      case "opening":
        this.value = this.value.toLowerCase();
        break;
      case "date":
        this.value = this.value.split(".");
        this.value[1] = padStart(this.value[1], 2, "0");
        this.value[2] = padStart(this.value[2], 2, "0");
        this.value = this.value.join(".");
        break;
      case "points":
        this.value = Number(this.value);
        break;
      case "rating1":
        this.value = Number(this.value);
        break;
      case "rating2":
        this.value = Number(this.value);
        break;
      case "result":
        this.value = this.value ? Result.parse(this.value) : "";
        break;
      case "round":
        this.value = Number(this.value);
        break;
      case "size":
        this.value = Number(this.value);
        break;
      case "tps":
        this.value = TPS.parse(this.value);
        if (!this.value.isValid) {
          throw this.value.errors[0];
        }
        break;
    }
    this.valueText =
      this.value.text !== undefined ? this.value.text : this.value.toString();
  }

  get output() {
    return Object.freeze(this.value.output || this.value);
  }

  static parse(notation) {
    return new Tag(notation);
  }

  static now = now;
  static dateFromDate = dateFromDate;
  static timeFromDate = timeFromDate;
  static toDate = toDate;

  toString() {
    return `[${this.key} "${this.valueText}"]`;
  }
}
