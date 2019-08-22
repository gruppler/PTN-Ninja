export default class Evaluation {
  constructor(notation) {
    const matchData = notation.match(/([?!'"]+)/);

    if (!matchData) {
      throw new Error("Invalid evaluation");
    }

    [this.ptn] = matchData;

    this.text = this.ptn;
    this.tinue = /''|"/.test(this.ptn);
    this.tak = !this.tinue && this.ptn.includes("'");
  }

  static parse(notation) {
    return new Evaluation(notation);
  }
}
