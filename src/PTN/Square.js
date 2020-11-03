import Ply from "./Ply";

export default class Square {
  constructor(x, y, size) {
    this.piece = null;
    this.pieces = [];
    this.isSelected = false;

    this.coord = Ply.itoa(x, y);
    this.x = x;
    this.y = y;
    this.edges = [];
    this.edges.N = false;
    this.edges.S = false;
    this.edges.E = false;
    this.edges.W = false;
    this.isEdge = false;
    this.isCorner = false;
    this.isNS = false;
    this.isEW = false;
    this.neighbors = [];
    this.neighbors.N = null;
    this.neighbors.E = null;
    this.neighbors.S = null;
    this.neighbors.W = null;

    if (y == size - 1) {
      this.edges.push("N");
      this.edges.N = true;
      this.isEdge = true;
      this.isNS = true;
    }
    if (y == 0) {
      this.edges.push("S");
      this.edges.S = true;
      this.isEdge = true;
      this.isNS = true;
    }
    if (x == size - 1) {
      this.edges.push("E");
      this.edges.E = true;
      this.isEdge = true;
      this.isEW = true;
    }
    if (x == 0) {
      this.edges.push("W");
      this.edges.W = true;
      this.isEdge = true;
      this.isEW = true;
    }
    this.isCorner = this.edges.length == 2;
  }

  getPiece() {
    return this.pieces.length ? this.pieces[this.pieces.length - 1] : null;
  }

  setPiece(index, piece) {
    piece.square = this;
    this.pieces[index] = piece;
    if (index === this.pieces.length - 1) {
      this.piece = piece;
    }
  }

  pushPiece(piece) {
    piece.square = this;
    this.piece = piece;
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
    this.piece = this.getPiece();
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
}
