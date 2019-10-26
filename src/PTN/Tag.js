import TPS from "./TPS";
import Result from "./Result";

export const formats = {
  clock: /^\d+min(\+\d+sec)$|^((((\d\s+)?\d\d?:)?\d\d?:)?\d\d?\s*)?(\+(((\d\s+)?\d\d?:)?\d\d?:)?\d\d?)?$/,
  date: /^(\d{4})\.(\d\d)\.(\d\d)$/,
  event: /^[^"]*$/,
  player1: /^[^"]*$/,
  player2: /^[^"]*$/,
  points: /^\d*$/,
  rating1: /^\d*$/,
  rating2: /^\d*$/,
  result: /^(R-0|0-R|F-0|0-F|1-0|0-1|1\/2-1\/2|)$/,
  round: /^\d*$/,
  site: /^[^"]*$/,
  size: /^[3-8]$/,
  time: /^\d\d(:\d\d){1,2}$/,
  tps: /^[1-8xSC/,]+\s+[1,2]\s+\d+$/
};

export default class Tag {
  constructor(notation) {
    const matchData = notation.match(/\[([^\s]+)\s*"([^"]*)"\]/);

    if (!matchData) {
      throw new Error("Invalid tag: " + notation);
    }

    [this.ptn, this.key, this.value] = matchData;

    const key = this.key.toLowerCase();

    if (key in formats) {
      if (!formats[key].test(this.value)) {
        throw new Error(`Invalid ${key}: ${this.value}`);
      }
    } else {
      throw new Error("Unrecognized tag");
    }

    switch (key) {
      case "points":
        this.value = 1 * this.value;
        break;
      case "rating1":
        this.value = 1 * this.value;
        break;
      case "rating2":
        this.value = 1 * this.value;
        break;
      case "result":
        this.value = Result.parse(this.value);
        break;
      case "round":
        this.value = 1 * this.value;
        break;
      case "size":
        this.value = 1 * this.value;
        break;
      case "tps":
        this.value = TPS.parse(this.value);
        break;
    }
    this.valueText =
      this.value.text !== undefined ? this.value.text : this.value;
  }

  static parse(notation) {
    return new Tag(notation);
  }

  text() {
    return `[${this.key} "${this.valueText}"]`;
  }
}
