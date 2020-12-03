const atoi = coord => [
  "abcdefgh".indexOf(coord[0]),
  parseInt(coord[1], 10) - 1
];
exports.atoi = atoi;

const itoa = (x, y) => "abcdefgh"[x] + (y + 1);
exports.itoa = itoa;

const OPPOSITE = {
  N: "S",
  S: "N",
  E: "W",
  W: "E"
};

const EDGE = {
  N: "NS",
  S: "NS",
  E: "EW",
  W: "EW"
};

exports.Square = class {
  constructor(x, y, size) {
    this.piece = null;
    this.color = null;
    this.pieces = [];
    this.isSelected = false;
    this.isStanding = false;
    this.roads = new Sides();
    this.connected = new Sides({
      disable: side => this.roads.set(side, false)
    });

    this.coord = itoa(x, y);
    this.x = x;
    this.y = y;
    this.edges = new Sides({
      enable: side => {
        this.isEdge = true;
        this["is" + EDGE[side]] = true;
        this.isCorner = this.edges.length == 2;
      }
    });
    this.isLight = x % 2 !== y % 2;
    this.isEdge = false;
    this.isCorner = false;
    this.isNS = false;
    this.isEW = false;
    this.neighbors = new Sides();
    this.edges.setSides({
      N: y == size - 1,
      S: y == 0,
      E: x == size - 1,
      W: x == 0
    });
  }

  _getPiece() {
    return this.pieces.length ? this.pieces[this.pieces.length - 1] : null;
  }

  _setPiece(piece) {
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
      this._updateConnected();
    }
  }

  _updateConnected() {
    let neighbor, isConnected;
    Object.keys(EDGE).forEach(side => {
      if (this.edges[side]) {
        this.connected[side] = Boolean(this.piece && !this.isStanding);
      } else if ((neighbor = this.neighbors[side])) {
        isConnected = Boolean(
          neighbor.color === this.color &&
            this.piece &&
            !this.isStanding &&
            !neighbor.isStanding
        );
        this.connected[side] = isConnected;
        neighbor.connected[OPPOSITE[side]] = isConnected;
      }
    });
  }

  setRoad(road) {
    this.connected.forEach(side => {
      const isRoad = Boolean(
        road &&
          ((this.edges[side] && road.edges[EDGE[side]]) ||
            (this.neighbors[side] &&
              road.squares.includes(this.neighbors[side].coord)))
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
      this._setPiece(piece);
    }
  }

  pushPiece(piece) {
    piece.square = this;
    this._setPiece(piece);
    this.pieces.push(piece);
  }

  pushPieces(pieces) {
    pieces.forEach(piece => this.pushPiece(piece));
  }

  popPiece() {
    const piece = this.pieces.pop();
    if (piece) {
      piece.square = null;
    }
    this._setPiece(this._getPiece());
    return piece;
  }

  popPieces(count) {
    while (count--) {
      this.popPiece();
    }
  }

  clear() {
    while (this.pieces.length) {
      this.popPiece();
    }
  }
};

class Sides {
  constructor(options = {}) {
    this.onEnable = options.enable || null;
    this.onDisable = options.disable || null;

    this._index = {
      N: false,
      S: false,
      E: false,
      W: false
    };
    Object.keys(this._index).forEach(side => {
      Object.defineProperty(this, side, {
        get: () => this.get(side),
        set: value => this.set(side, value)
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
      "unshift"
    ].forEach(fn => (this[fn] = this._array[fn].bind(this._array)));
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
        this.push(typeof value === "boolean" ? side : value);
        this._index[side] = value;
        this.length = this._array.length;
        if (this.onEnable) {
          this.onEnable(side, value);
        }
      } else {
        this.splice(
          this.indexOf(typeof value === "boolean" ? side : this._index[side]),
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
}
