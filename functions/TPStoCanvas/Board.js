const { Square } = require("./Square");
const { Piece } = require("./Piece");
const { findRoads } = require("./Roads");
const { atoi } = require("./Square");

const pieceCounts = {
  3: { flat: 10, cap: 0 },
  4: { flat: 15, cap: 0 },
  5: { flat: 21, cap: 1 },
  6: { flat: 30, cap: 1 },
  7: { flat: 40, cap: 2 },
  8: { flat: 50, cap: 2 }
};

exports.Board = class {
  constructor(options) {
    this.options = options;
    this.errors = [];

    const matchData = options.tps.match(
      /(((x[1-8]?|[12]+[SC]?|,)+\/?)+)\s+([12])/
    );

    if (!matchData) {
      this.errors.push("Invalid TPS notation");
      return;
    }

    [, this.grid, , , this.player] = matchData;

    this.grid = this.grid
      .replace(/x(\d)/g, (x, count) => {
        let spaces = ["x"];
        while (spaces.length < count) {
          spaces.push("x");
        }
        return spaces.join(",");
      })
      .split("/")
      .reverse()
      .map(row => row.split(","));
    this.size = this.grid.length;
    this.player = Number(this.player);

    if (this.grid.find(row => row.length !== this.size)) {
      this.errors.push("Invalid TPS grid");
    }

    // Set up piece counts
    this.pieceCounts = {
      1: { ...pieceCounts[this.size] },
      2: { ...pieceCounts[this.size] }
    };
    if (options.flats) {
      this.pieceCounts[1].flat = Number(options.flats);
      this.pieceCounts[2].flat = Number(options.flats);
    }
    if (options.caps) {
      this.pieceCounts[1].cap = Number(options.caps);
      this.pieceCounts[2].cap = Number(options.caps);
    }
    if (options.flats1) {
      this.pieceCounts[1].flat = Number(options.flats1);
    }
    if (options.caps1) {
      this.pieceCounts[1].cap = Number(options.caps1);
    }
    if (options.flats2) {
      this.pieceCounts[2].flat = Number(options.flats2);
    }
    if (options.caps2) {
      this.pieceCounts[2].cap = Number(options.caps2);
    }
    this.pieceCounts[1].total =
      this.pieceCounts[1].flat + this.pieceCounts[1].cap;
    this.pieceCounts[2].total =
      this.pieceCounts[2].flat + this.pieceCounts[2].cap;

    // Create pieces
    this.pieces = {
      all: {
        1: { flat: [], cap: [] },
        2: { flat: [], cap: [] }
      },
      played: {
        1: { flat: [], cap: [] },
        2: { flat: [], cap: [] }
      }
    };
    [1, 2].forEach(color => {
      ["flat", "cap"].forEach(type => {
        for (let index = 0; index < this.pieceCounts[color][type]; index++) {
          this.pieces.all[color][type][index] = new Piece({
            index: index,
            color: color,
            type: type
          });
        }
      });
    });

    this.squares = [];
    for (let y = 0; y < this.size; y++) {
      this.squares[y] = [];
      for (let x = 0; x < this.size; x++) {
        this.squares[y][x] = new Square(x, y, this.size);
      }
    }

    // Create squares
    this.squares.forEach(row => {
      row.forEach(square => {
        if (!square.edges.N) {
          square.neighbors.N = this.squares[square.y + 1][square.x];
        }
        if (!square.edges.S) {
          square.neighbors.S = this.squares[square.y - 1][square.x];
        }
        if (!square.edges.E) {
          square.neighbors.E = this.squares[square.y][square.x + 1];
        }
        if (!square.edges.W) {
          square.neighbors.W = this.squares[square.y][square.x - 1];
        }
      });
    });

    // Do TPS
    let stack, square, piece, type;
    this.grid.forEach((row, y) => {
      row.forEach((col, x) => {
        if (col[0] !== "x") {
          stack = col.split("");
          square = this.squares[y][x];
          while ((piece = stack.shift())) {
            if (/[SC]/.test(stack[0])) {
              type = stack.shift();
            } else {
              type = "flat";
            }
            this.playPiece(piece, type, square);
          }
        }
      });
    });

    // Count flats
    this.flats = [0, 0];
    this.squares.forEach(row => {
      row.forEach(square => {
        if (square.color && square.piece.isFlat()) {
          this.flats[square.color - 1]++;
        }
      });
    });

    // Check for game end
    const roads = findRoads(this.squares);
    if (roads) {
      roads[1].concat(roads[2]).forEach(road => {
        road.squares.forEach(coord => {
          coord = atoi(coord);
          this.squares[coord[1]][coord[0]].setRoad(road);
        });
      });
    }
  }

  playPiece(color, type, square) {
    const isStanding = /S|wall/.test(type);
    if (!(type in this.pieceCounts[1])) {
      type = type === "C" ? "cap" : "flat";
    }
    const piece = this.pieces.all[color][type][
      this.pieces.played[color][type].length
    ];
    if (piece) {
      piece.isStanding = isStanding;
      this.pieces.played[color][type].push(piece);
      square.pushPiece(piece);
      return piece;
    }
    return null;
  }
};
