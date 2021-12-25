import { defaults, pick } from "lodash";

export default class Piece {
  constructor(params) {
    defaults(this, {
      board: null,
      ply: null,
      color: 1,
      isCapstone: false,
      reactive: {
        square: null,
        isStanding: false,
        isSelected: false,
      },
    });
    Object.keys(params).forEach((key) => (this[key] = params[key]));
  }

  get square() {
    return this.reactive.square;
  }
  set square(square) {
    this.reactive.square = square;
    if (this.board) {
      this.board.dirtyPiece(this.id);
    }
  }

  get isStanding() {
    return this.reactive.isStanding;
  }
  set isStanding(isStanding) {
    this.reactive.isStanding = isStanding;
    if (this.board) {
      this.board.dirtyPiece(this.id);
    }
  }

  get isSelected() {
    return this.reactive.isSelected;
  }
  set isSelected(isSelected) {
    this.reactive.isSelected = isSelected;
    if (this.board) {
      this.board.dirtyPiece(this.id);
    }
  }

  get snapshot() {
    return Object.freeze({
      ...pick(this, [
        "id",
        "index",
        "color",
        "isSelected",
        "isStanding",
        "isCapstone",
        "isImmovable",
      ]),
      ...this.state,
      type: this.type,
      typeCode: this.typeCode,
      square: this.square ? this.square.static.coord : null,
    });
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
    if (state.ply && state.ply in this.board.game.plies) {
      this.ply = this.board.game.plies[state.ply];
    }
    if (state.type) {
      this.type = state.type;
    }
    if ("x" in state && "y" in state && "z" in state) {
      const square = this.board.squares[state.y][state.x];
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
      ? this.square.pieces.length - this.z > this.board.game.size
      : false;
  }

  get isFlat() {
    return !(this.isCapstone || this.isStanding);
  }
}
