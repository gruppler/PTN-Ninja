import { defaults } from "lodash";

export default class Piece {
  constructor(params) {
    defaults(this, {
      game: null,
      square: null,
      ply: null,
      color: 1,
      isSelected: false,
      isStanding: false,
      isCapstone: false,
    });
    Object.keys(params).forEach((key) => (this[key] = params[key]));
  }

  get state() {
    return {
      ply: this.ply ? this.ply.id : undefined,
      type: this.typeCode || undefined,
      index: this.index,
      x: this.x,
      y: this.y,
      z: this.z,
    };
  }

  set state(state) {
    this.index = state.index;
    if (state.ply && state.ply in this.game) {
      this.ply = this.game.plies[state.ply];
    }
    if (state.type) {
      this.type = state.type;
    }
    if ("x" in state && "y" in state && "z" in state) {
      const square = this.game.state.squares[state.y][state.x];
      if (square) {
        this.square = square;
        square[state.z] = this;
      }
    }
  }

  get typeCode() {
    return this.isCapstone ? "C" : this.isStanding ? "S" : "";
  }

  get type() {
    return this.isCapstone ? "cap" : "flat";
  }

  set type(type) {
    this.isStanding = /S|wall/.test(type);
    this.isCapstone = /C|cap/.test(type);
  }

  get x() {
    return this.square ? this.square.static.x : null;
  }
  get y() {
    return this.square ? this.square.static.y : null;
  }
  get z() {
    return this.square ? this.square.pieces.indexOf(this) : null;
  }

  get isImmovable() {
    return this.square
      ? this.square.pieces.length - this.z > this.game.size
      : false;
  }

  get isFlat() {
    return !(this.isCapstone || this.isStanding);
  }
}
