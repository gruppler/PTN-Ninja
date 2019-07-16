export default class Piece {
  constructor({ x, y, z, stackHeight, color, isStanding, isCapstone }) {
    this.x = x;
    this.y = y;
    this.z = z || 0;
    this.stackHeight = stackHeight || 1;
    this.color = color;
    this.isStanding = isStanding || false;
    this.isCapstone = isCapstone || false;
  }
}
