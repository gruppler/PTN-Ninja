import Ply from "./Ply";

export default class Square extends Array {
  constructor(x, y, size) {
    super();
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
}
