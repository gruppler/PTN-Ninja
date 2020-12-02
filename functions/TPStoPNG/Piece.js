exports.Piece = class {
  constructor(params) {
    this.index = params.index;
    this.color = params.color;
    this.type = params.type;
    this.square = null;
    this.isStanding = false;
    this.isCapstone = false;
  }

  typeCode() {
    return this.isCapstone ? "C" : this.isStanding ? "S" : "";
  }

  type() {
    return this.isCapstone ? "cap" : "flat";
  }

  setType(type) {
    this.isStanding = /S|wall/.test(type);
    this.isCapstone = /C|cap/.test(type);
  }

  x() {
    return this.square ? this.square.static.x : null;
  }
  y() {
    return this.square ? this.square.static.y : null;
  }
  z() {
    return this.square ? this.square.pieces.indexOf(this) : null;
  }

  isImmovable() {
    return this.square
      ? this.square.pieces.length - this.z > this.game.size
      : false;
  }

  isFlat() {
    return !(this.isCapstone || this.isStanding);
  }
};
