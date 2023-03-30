export default class Ptn {
  constructor(notation) {
    const matchData = notation.match(
      /(\d)?([CS])?([a-h])([1-8])(([<>+-])([1-8]+)?(\*)?)?/i
    );

    if (!matchData) {
      throw new Error("Invalid PTN format");
    }

    [
      this.ptn,
      this.pieceCount,
      this.specialPiece,
      this.column,
      this.row,
      this.movement,
      this.direction,
      this.distribution,
      this.wallSmash,
    ] = matchData;

    if (this.specialPiece) {
      this.specialPiece = this.specialPiece.toUpperCase();
    }
    this.column = this.column.toLowerCase();

    this.pieceType = this.specialPiece === "C" ? "cap" : "flat";

    this.y = parseInt(this.row, 10) - 1;
    this.x = "abcdefgh".indexOf(this.column);

    if (this.movement && !this.pieceCount) {
      this.pieceCount = "" + 1;
    }

    if (this.movement && !this.distribution) {
      this.distribution = "" + (this.pieceCount || 1);
    }
  }

  /**
   * Converts PTN into an OpenTak standard moveset
   *
   * @example
   *   Ptn.parse('3c3>111') // => [{
   *     action: 'pop', count: 3, x: 2, y: 2
   *   }, {
   *     action: 'push', count: 1, x: 3, y: 2
   *   }, {
   *     action: 'push', count: 1, x: 4, y: 2
   *   }, {
   *     action: 'push', count: 1, x: 5, y: 2
   *   }]
   *
   * @param  {Boolean} reverse Whether or not this is an undo action
   *
   * @return {Array}   Set of moves that can be applied
   */
  toMoveset(reverse = false) {
    const types = { C: "cap", S: "wall", F: "flat" };

    if (!this.isValid()) return [{ errors: this.errors }];

    if (this.isPlacement())
      return [
        {
          action: reverse ? "pop" : "push",
          x: this.x,
          y: this.y,
          type: types[this.specialPiece] || "flat",
        },
      ];

    const firstMove = {
      action: reverse ? "push" : "pop",
      count: parseInt(this.pieceCount, 10),
      x: this.x,
      y: this.y,
    };

    const [xOffset, yOffset] = this.directionModifier();

    let moveSet = this.stackDistribution().map((n, i) => {
      return {
        action: reverse ? "pop" : "push",
        count: n,
        x: this.x + xOffset * (i + 1),
        y: this.y + yOffset * (i + 1),
      };
    });

    if (this.wallSmash) {
      moveSet[moveSet.length - 1].flatten = true;
    }

    return [firstMove, ...moveSet];
  }

  /**
   * Converts Ptn into an OpenTak standard undo moveset
   *
   * @return {Array} Set of moves used to undo a movement when applied
   */
  toUndoMoveset() {
    return this.toMoveset(true).reverse();
  }

  static fromMoveset(moveSet) {
    const types = { cap: "C", wall: "S", flat: "" };

    const { x, y, count, type } = moveSet[0];

    const square = `${count || ""}${types[type] || ""}${"abcdefgh"[x]}${y + 1}`;

    if (moveSet.length === 1) return square;

    const { x: x2, y: y2 } = moveSet[1];

    const direction = this.getDirection([x2 - x, y2 - y]);

    const distribution = moveSet.slice(1).reduce((s, { count, flatten }) => {
      return s + count + (flatten ? "*" : "");
    }, "");

    return `${square}${direction}${distribution}`;
  }

  static fromUndoMoveset(moveSet) {
    return this.fromMoveset([...moveSet].reverse());
  }

  /**
   * Static constructor
   *
   * @param  {String} notation PlayTak notation
   *
   * @return {Ptn}    Parsed PTN
   */
  static parse(notation) {
    return new Ptn(notation);
  }

  /**
   * Checks for the validity of a PTN sequence outside of the
   * above regex match.
   *
   * @note This explicitly avoids bounds checking and other
   *       behavior that should be exclusively the knowledge
   *       of a board
   *
   * @mutates [this.errors] Records errors
   *
   * @return {Boolean} Whether or not the PTN is valid
   */
  isValid() {
    this.errors = [];

    if (this.isMovement() && !this.isValidStackDistribution()) {
      this.errors.push("PTN does not contain a valid stack distribution");
    }

    if (!this.isMovement() && !this.isPlacement()) {
      this.errors.push("PTN is not a movement or placement");
    }

    return !this.errors.length;
  }

  /**
   * Finds the distribution of a PTN stack
   *
   * @example Given '3c3>111', the distribution would be [1, 1, 1]
   *
   * @return {Array} Move distribution counts
   */
  stackDistribution() {
    return this.distribution.split("").map((s) => parseInt(s, 10));
  }

  /**
   * Total number of tiles to be distributed
   *
   * @return {Integer}
   */
  stackTotal() {
    if (!this.distribution) {
      return 1;
    }

    return this.distribution.split("").reduce((a, i) => a + parseInt(i, 10), 0);
  }

  /**
   * Validation method to check if a player is distrubuting more than
   * or less than the total tiles they've picked up.
   *
   * @return {Boolean}
   */
  isValidStackDistribution() {
    if (!this.pieceCount && !this.distribution) {
      return true;
    }

    return parseInt(this.pieceCount, 10) === this.stackTotal();
  }

  /**
   * Whether or not this PTN indicates a movement
   *
   * @return {Boolean}
   */
  isMovement() {
    return !!this.movement;
  }

  /**
   * Whether or not this PTN indicates a placement
   *
   * @return {Boolean}
   */
  isPlacement() {
    return !this.isMovement() && !this.pieceCount;
  }

  /**
   * The final column this PTN would distribute to. Used for board
   * validation
   *
   * @return {Integer}
   */
  columnTrajectory() {
    const offset = this.directionModifier()[0] * this.stackTotal();

    return this.x + offset;
  }

  /**
   * The final row this PTN would distribute to. Used for board
   * validation
   *
   * @return {Integer}
   */
  rowTrajectory() {
    const offset = this.directionModifier()[1] * this.stackTotal();

    return this.y + offset;
  }

  /**
   * Offset modifiers used to calculate x and y coordinates over
   * distributions of pieces
   *
   * [0] - X or Column offset
   * [1] - Y or Row offset
   *
   * @return {Array} x and y offsets per direction
   */
  directionModifier() {
    switch (this.direction) {
      case "+":
        return [0, 1];
      case "-":
        return [0, -1];
      case ">":
        return [1, 0];
      case "<":
        return [-1, 0];
      default:
        return [0, 0];
    }
  }

  static getDirection([x, y]) {
    if (x === 0 && y === 1) return "+";
    if (x === 0 && y === -1) return "-";
    if (x === 1 && y === 0) return ">";
    if (x === -1 && y === 0) return "<";

    return "";
  }
}
