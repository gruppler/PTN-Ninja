import Ply from "./Ply";

export default class Square extends Array {
  constructor(x, y, size) {
    super();
    this.id = Ply.itoa(x, y);
    this.x = x;
    this.y = y;
    this.edges = "";
    this.isEdge = false;
    this.isCorner = false;
    this.isNS = false;
    this.isEW = false;
    this.isSelected = false;

    if (y == size - 1) {
      this.edges += "n";
      this.isEdge = true;
      this.isNS = true;
    }
    if (y == 0) {
      this.edges += "s";
      this.isEdge = true;
      this.isNS = true;
    }
    if (x == size - 1) {
      this.edges += "e";
      this.isEdge = true;
      this.isEW = true;
    }
    if (x == 0) {
      this.edges += "w";
      this.isEdge = true;
      this.isEW = true;
    }
    this.isCorner = this.edges.length == 2;
  }

  n(squares) {
    return this.edges.includes("n") ? null : squares[this.y + 1][this.x];
  }
  s(squares) {
    return this.edges.includes("s") ? null : squares[this.y - 1][this.x];
  }
  e(squares) {
    return this.edges.includes("e") ? null : squares[this.y][this.x + 1];
  }
  w(squares) {
    return this.edges.includes("w") ? null : squares[this.y][this.x - 1];
  }
}
