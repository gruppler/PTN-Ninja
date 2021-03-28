import { pick } from "lodash";

const outputProps = ["text", "tinue", "tak", "?", "!"];

export default class Evaluation {
  constructor(notation) {
    const matchData = notation.match(/([?!'"]+)/);

    if (notation) {
      if (!matchData) {
        throw new Error("Invalid evaluation");
      }
      [this.ptn] = matchData;
    } else {
      this.ptn = "";
    }

    this.text = this.ptn;
    this.tinue = /''|"/.test(this.ptn);
    this.tak = !this.tinue && this.ptn.includes("'");
    this["?"] = this.ptn.includes("?");
    this["!"] = this.ptn.includes("!");
  }

  get output() {
    return Object.freeze({
      ...pick(this, outputProps),
      isDouble: {
        "?": this.isDouble("?"),
        "!": this.isDouble("!"),
      },
    });
  }

  isDouble(type) {
    return (type === "?" ? /\?\?/ : /!!/).test(this.text);
  }

  static test(notation) {
    return /^[?!'"]/.test(notation);
  }

  static parse(notation) {
    return new Evaluation(notation);
  }
}
