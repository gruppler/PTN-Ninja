import { itoa } from "./Ply";

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
  constructor(x, y, size) {
    this.piece = null;
    this.color = null;
    this.pieces = [];
    this.isSelected = false;
    this.isStanding = false;
    this.roads = new Sides();
    this.connected = new Sides({
      disable: (side) => this.roads.set(side, false),
    });

    this.static = {
      coord: itoa(x, y),
      x: x,
      y: y,
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
    };
    this.static.edges.setSides({
      N: y == size - 1,
      S: y == 0,
      E: x == size - 1,
      W: x == 0,
    });
    this.static.edges.onEnable = null;
    Object.freeze(this.static.edges);
  }

  get snapshot() {
    return {
      static: this.static,
      ...pick(this, ["connected", "roads", "isSelected"]),
      piece: this.piece ? this.piece.id : null,
      pieces: this.pieces ? this.pieces.map((piece) => piece.id) : null,
    };
  }

  _getPiece() {
    return this.pieces.length ? this.pieces[this.pieces.length - 1] : null;
  }

  _setPiece(piece, deferUpdate = false) {
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
    if (this.color !== prevColor || this.isStanding !== wasStanding) {
      if (!deferUpdate) {
        this.updateConnected();
      }
    }
  }

  clear() {
    this.pieces.forEach((piece) => {
      piece.isStanding = false;
      piece.square = null;
    });
    this.pieces.length = 0;
    this.color = null;
    this.clearConnected();
  }

  clearConnected() {
    this.connected.clear();
  }

  updateConnected() {
    let neighbor, isConnected;
    Object.keys(EDGE).forEach((side) => {
      if (this.static.edges[side]) {
        this.connected[side] = !!(this.piece && !this.isStanding);
      } else if ((neighbor = this.static.neighbors[side])) {
        isConnected = !!(
          this.piece &&
          !this.isStanding &&
          !neighbor.isStanding &&
          neighbor.color === this.color
        );
        this.connected[side] = isConnected;
        neighbor.connected[OPPOSITE[side]] = isConnected;
      }
    });
  }

  setRoad(road) {
    this.connected.forEach((side) => {
      const isRoad = !!(
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

  setStackPiece(index, piece, deferUpdate = false) {
    piece.square = this;
    this.pieces[index] = piece;
    if (index === this.pieces.length - 1) {
      this._setPiece(piece, deferUpdate);
    }
  }

  pushPiece(piece, deferUpdate = false) {
    piece.square = this;
    this._setPiece(piece, deferUpdate);
    this.pieces.push(piece);
  }

  pushPieces(pieces, deferUpdate = false) {
    pieces.forEach((piece) => this.pushPiece(piece, deferUpdate));
  }

  popPiece(deferUpdate = false) {
    const piece = this.pieces.pop();
    if (piece) {
      piece.square = null;
    }
    this._setPiece(this._getPiece(), deferUpdate);
    return piece;
  }

  popPieces(count, deferUpdate = false) {
    while (count--) {
      this.popPiece(deferUpdate);
    }
  }
}

export class Sides {
  constructor(options = {}) {
    this.onEnable = options.enable || null;
    this.onDisable = options.disable || null;

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
