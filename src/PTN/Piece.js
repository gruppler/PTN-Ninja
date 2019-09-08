export default class Piece {
  constructor(params) {
    this.square = params.square;
    this.x = params.square.x;
    this.y = params.square.y;
    this.z = params.z || 0;
    this.color = params.color;
    this.isStanding = params.isStanding || false;
    this.isCapstone = params.isCapstone || false;
  }
}
