export default class Piece {
  constructor(params) {
    this.game = params.game;
    this.ply = params.ply || null;
    this.square = params.square;
    this.color = params.color;
    this.isStanding = /S|wall/.test(params.type);
    this.isCapstone = /C|cap/.test(params.type);
    this.type = this.isCapstone ? "cap" : "flat";
  }

  get x() {
    return this.square.x;
  }
  get y() {
    return this.square.y;
  }
  get z() {
    return this.square.indexOf(this);
  }

  get isFlat() {
    return !(this.isCapstone || this.isStanding);
  }

  get isImmovable() {
    return this.square.length - this.z > this.game.size;
  }

  get isSelected() {
    return this.game.state.selected.pieces.includes(this);
  }
}
