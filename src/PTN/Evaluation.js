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
