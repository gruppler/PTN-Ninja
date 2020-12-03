exports.Piece = class {
  constructor(params) {
    this.index = params.index;
    this.color = params.color;
    this.type = params.type;
    this.square = null;
    this.isStanding = false;
    this.isCapstone = false;
    this.setType(this.type);
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
    return this.square ? this.square.x : null;
  }
  y() {
    return this.square ? this.square.y : null;
  }
  z() {
    return this.square ? this.square.pieces.indexOf(this) : null;
  }

  isFlat() {
    return !(this.isCapstone || this.isStanding);
  }
};
