import { defaults } from "lodash";

export default class Piece {
  constructor(params) {
    defaults(this, {
      game: null,
      square: null,
      ply: null,
      color: 1,
      isStanding: false,
      isCapstone: false
    });
    Object.keys(params).forEach(key => (this[key] = params[key]));
  }

  get state() {
    return {
      ply: this.ply ? this.ply.id : undefined,
      type: this.typeCode || undefined,
      x: this.x,
      y: this.y,
      z: this.z
    };
  }

  set state(state) {
    if (state.ply && state.ply in this.game) {
      this.ply = this.game.plies[state.ply];
    }
    if (state.type) {
      this.type = state.type;
    }
    const square = this.game.state.squares[state.y][state.x];
    if (square) {
      this.square = square;
      square[state.z] = this;
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
