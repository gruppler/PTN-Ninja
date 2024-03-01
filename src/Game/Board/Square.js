import { itoa } from "../PTN/Ply";

import { isBoolean, pick } from "lodash";

const OPPOSITE = {
  N: "S",
  S: "N",
  E: "W",
  W: "E",
};

const EDGE = {
  N: "NS",
  S: "NS",
  E: "EW",
  W: "EW",
};

export default class Square {
  constructor(x, y, board) {
    this.board = board;
    this.piece = null;
    this.color = null;
    this.pieces = [];
    this.isSelected = false;
    this.isStanding = false;
    this.roads = new Sides({
      change: () => this.board.dirtySquare(this.static.coord),
    });
    this.connected = new Sides({
      disable: (side) => {
        this.roads.set(side, false);
      },
      change: () => this.board.dirtySquare(this.static.coord),
    });

    this.static = {
      coord: itoa(x, y),
      x,
      y,
      edges: new Sides({
        enable: (side) => {
          this.static.isEdge = true;
          this.static["is" + EDGE[side]] = true;
          this.static.isCorner = this.static.edges.length == 2;
        },
      }),
      isLight: x % 2 !== y % 2,
      isEdge: false,
      isCorner: false,
      isNS: false,
      isEW: false,
      neighbors: new Sides(),
      ring: 0,
    };
    this.static.edges.setSides({
      N: y == this.board.game.size - 1,
      S: y == 0,
      E: x == this.board.game.size - 1,
      W: x == 0,
    });
    this.static.edges.onEnable = null;
    if (this.static.isEdge) {
      this.static.ring = 1;
    } else {
      const offset = (this.board.game.size - 1) / 2;
      const getRing = (x) => 1 + Math.round(offset - Math.abs(x - offset));
      this.static.ring = Math.min(getRing(x), getRing(y));
    }
    Object.freeze(this.static.edges);
  }

  get snapshot() {
    return Object.freeze({
      static: this.static,
      connected: this.connected.output,
      roads: this.roads.output,
      isSelected: this.isSelected,
      piece: this.piece ? this.piece.id : null,
      pieces: this.pieces ? this.pieces.map((piece) => piece.id) : null,
    });
  }

  _getPiece() {
    return this.pieces.length ? this.pieces[this.pieces.length - 1] : null;
  }

  setPiece(piece) {
    const prevPiece = this.piece;
    const prevColor = this.color;
    const wasStanding = this.piece && this.isStanding;

    this.piece = piece;
    if (piece) {
      this.color = piece.color;
      this.isStanding = piece.isStanding;
    } else {
      this.color = null;
      this.isStanding = false;
    }
    this.board.dirtySquare(
      this.static.coord,
      this.color !== prevColor || this.isStanding !== wasStanding
    );
  }

  clear() {
    const prevPiece = this.piece;
    const prevColor = this.color;
    const wasStanding = this.piece && this.isStanding;
    this.pieces.forEach((piece) => {
      piece.isStanding = false;
      piece.square = null;
    });
    this.pieces.length = 0;
    this.piece = null;
    this.color = null;
    this.isStanding = false;
    this.clearConnected();
    this.board.dirtySquare(
      this.static.coord,
      this.color !== prevColor || this.isStanding !== wasStanding
    );
    if (prevPiece) {
      this.board.dirtySquare(
        this.static.coord,
        this.color !== prevColor || this.isStanding !== wasStanding
      );
    }
  }

  clearConnected() {
    this.connected.clear();
  }

  updateConnected() {
    let neighbor, isConnected;
    this.static.edges.forEachSide((isEdge, side) => {
      if (isEdge) {
        this.connected[side] = Boolean(this.piece && !this.isStanding);
      } else if ((neighbor = this.static.neighbors[side])) {
        isConnected = Boolean(
          this.piece &&
            !this.isStanding &&
            !neighbor.isStanding &&
            neighbor.color === this.color
        );
        if (this.connected[side] !== isConnected) {
          this.connected[side] = isConnected;
        }
        if (neighbor.connected[OPPOSITE[side]] !== isConnected) {
          neighbor.connected[OPPOSITE[side]] = isConnected;
        }
      }
    });
  }

  setRoad(road) {
    this.connected.forEach((side) => {
      const isRoad = Boolean(
        road &&
          ((this.static.edges[side] && road.edges[EDGE[side]]) ||
            (this.static.neighbors[side] &&
              road.squares.includes(this.static.neighbors[side].static.coord)))
      );
      if (!road || isRoad) {
        this.roads[side] = isRoad;
      }
    });
  }

  setStackPiece(index, piece) {
    piece.square = this;
    this.pieces[index] = piece;
    if (index === this.pieces.length - 1) {
      return this.setPiece(piece);
    }
  }

  pushPiece(piece) {
    piece.square = this;
    this.pieces.push(piece);
    if (this.pieces.length >= this.board.game.size) {
      this.pieces
        .slice(-1 - this.board.game.size)
        .forEach((piece) => this.board.dirtyPiece(piece.id));
    }
    return this.setPiece(piece);
  }

  pushPieces(pieces) {
    pieces.forEach((piece) => this.pushPiece(piece));
  }

  popPiece() {
    const piece = this.pieces.pop();
    if (piece) {
      piece.square = null;
    }
    this.setPiece(this._getPiece());
    if (this.pieces.length >= this.board.game.size) {
      this.pieces
        .slice(0 - this.board.game.size)
        .forEach((piece) => this.board.dirtyPiece(piece.id));
    }
    return piece;
  }

  popPieces(count) {
    while (count--) {
      this.popPiece();
    }
  }
}

export class Sides {
  constructor(options = {}) {
    this.onEnable = options.enable || null;
    this.onDisable = options.disable || null;
    this.onChange = options.change || null;

    this._index = {
      N: false,
      S: false,
      E: false,
      W: false,
    };
    Object.keys(this._index).forEach((side) => {
      Object.defineProperty(this, side, {
        get: () => this.get(side),
        set: (value) => this.set(side, value),
      });
    });

    this.length = 0;
    this._array = [];
    [
      "concat",
      "filter",
      "find",
      "forEach",
      "includes",
      "indexOf",
      "map",
      "pop",
      "push",
      "shift",
      "splice",
      "unshift",
    ].forEach((fn) => (this[fn] = this._array[fn].bind(this._array)));
  }

  forEachSide(fn) {
    Object.keys(this._index).forEach((side) => fn(this._index[side], side));
  }

  get output() {
    return { ...this._index, ...this._array, length: this.length };
  }

  setSides(values) {
    if (values) {
      for (let side in values) {
        this.set(side, values[side]);
      }
    }
  }

  get(side) {
    return this._index[side];
  }

  set(side, value) {
    if (this._index[side] !== value) {
      if (value) {
        this.push(isBoolean(value) ? side : value);
        this._index[side] = value;
        this.length = this._array.length;
        if (this.onEnable) {
          this.onEnable(side, value);
        }
      } else {
        this.splice(
          this.indexOf(isBoolean(value) ? side : this._index[side]),
          1
        );
        this._index[side] = value;
        this.length = this._array.length;
        if (this.onDisable) {
          this.onDisable(side, value);
        }
      }
      if (this.onChange) {
        this.onChange(side, value);
      }
    }
  }

  clear() {
    if (this.onDisable) {
      this.forEach((side) => {
        this.onDisable(side, false);
      });
    }
    this._index.N = false;
    this._index.S = false;
    this._index.E = false;
    this._index.W = false;
    this._array.length = 0;
    this.length = 0;
  }
}
