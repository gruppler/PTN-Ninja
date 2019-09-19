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

  static parse(notation) {
    return new Evaluation(notation);
  }
}
