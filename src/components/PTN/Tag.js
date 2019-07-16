import TPS from "./TPS";
import Result from "./Result";

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
          this.value = this.$t("Player1_name");
        }
        break;
      case "player2":
        if (!this.value.length) {
          this.value = this.$t("Player2_name");
        }
        break;
      case "date":
        this.value = this.value;
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
    this.valueText = this.value.text ? this.value.text : this.value;
  }

  static parse(notation) {
    return new Tag(notation);
  }

  text() {
    return `[${this.key} "${this.valueText}"]`;
  }
}
