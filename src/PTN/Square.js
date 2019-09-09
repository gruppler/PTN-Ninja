import Ply from "./Ply";

export default class Square extends Array {
  constructor(x, y, size) {
    super();
    this.coord = Ply.itoa(x, y);
    this.x = x;
    this.y = y;
    this.edges = "";
    this.isEdge = false;
    this.isCorner = false;
    this.isNS = false;
    this.isEW = false;
    this.isSelected = false;
    this.neighbors = [];
    this.N = null;
    this.E = null;
    this.S = null;
    this.W = null;

    if (y == size - 1) {
      this.edges += "N";
      this.isEdge = true;
      this.isNS = true;
    }
    if (y == 0) {
      this.edges += "S";
      this.isEdge = true;
      this.isNS = true;
    }
    if (x == size - 1) {
      this.edges += "E";
      this.isEdge = true;
      this.isEW = true;
    }
    if (x == 0) {
      this.edges += "W";
      this.isEdge = true;
      this.isEW = true;
    }
    this.isCorner = this.edges.length == 2;
  }
}
