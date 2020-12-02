const { Square } = require("./Square");
const { Piece } = require("./Piece");
const { Result } = require("./Result");
const { findRoads } = require("./Roads");

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
        if (!square.static.edges.N) {
          square.static.neighbors.N = this.squares[square.static.y + 1][
            square.static.x
          ];
        }
        if (!square.static.edges.S) {
          square.static.neighbors.S = this.squares[square.static.y - 1][
            square.static.x
          ];
        }
        if (!square.static.edges.E) {
          square.static.neighbors.E = this.squares[square.static.y][
            square.static.x + 1
          ];
        }
        if (!square.static.edges.W) {
          square.static.neighbors.W = this.squares[square.static.y][
            square.static.x - 1
          ];
        }
        Object.freeze(square.static);
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

    // Check for game end
    const player = this.player;
    const pieces = this.pieces.played[player];
    let roads = findRoads(this.squares);
    let result;

    if (roads && roads.length) {
      // Check current player first
      if (roads[player].length) {
        result = player == 1 ? "R-0" : "0-R";
      } else if (roads[player == 1 ? 2 : 1].length) {
        // Completed opponent's road
        result = player == 1 ? "0-R" : "R-0";
      }
    } else if (
      pieces.flat.length + pieces.cap.length ===
        this.pieceCounts[player].total ||
      !this.state.squares.find(row => row.find(square => !square.pieces.length))
    ) {
      // Last empty square or last piece
      if (this.state.flats[0] == this.state.flats[1]) {
        // Draw
        result = "1/2-1/2";
      } else if (this.state.flats[0] > this.state.flats[1]) {
        result = "F-0";
      } else {
        result = "0-F";
      }
    }

    if (result) {
      result = new Result(result);
      if (roads && roads.length) {
        result.roads = roads;
      }
      this.result = result;
    } else {
      this.result = null;
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
