import Game from "./Game";
import TPS from "./TPS";
import Result from "./Result";
import { padStart } from "lodash";

const today = function() {
  const d = new Date();
  return (
    d.getFullYear() +
    "." +
    padStart(d.getMonth() + 1, 2, 0) +
    "." +
    padStart(d.getDate(), 2, 0)
  );
};

export default class Tag {
  constructor(notation) {
    const matchData = notation.match(/\[([^\s]+)\s*"([^"]*)"\]/);

    if (!matchData) {
      throw new Error("Invalid tag: " + notation);
    }

    [this.ptn, this.key, this.value] = matchData;

    switch (this.key.toLowerCase()) {
      case "size":
        if (/^([3-8])$/.test(this.value)) {
          this.value = 1 * this.value;
        } else {
          throw new Error("Invalid size: " + this.value);
        }
        break;
      case "player1":
        if (!this.value.length) {
          this.value = Game.t["White"];
        }
        break;
      case "player2":
        if (!this.value.length) {
          this.value = Game.t["Black"];
        }
        break;
      case "date":
        if (!this.value.length) {
          this.value = today();
        }
        break;
      case "result":
        this.value = Result.parse(this.value);
        break;
      case "event":
        this.value = this.value;
        break;
      case "site":
        this.value = this.value;
        break;
      case "round":
        this.value = 1 * this.value;
        break;
      case "rating1":
        this.value = 1 * this.value;
        break;
      case "rating2":
        this.value = 1 * this.value;
        break;
      case "tps":
        this.value = TPS.parse(this.value);
        break;
      case "points":
        this.value = 1 * this.value;
        break;
      case "time":
        this.value = this.value;
        break;
      case "clock":
        this.value = this.value;
        break;
      default:
        throw new Error("Unrecognized tag");
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
