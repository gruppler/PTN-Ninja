const { createCanvas } = require("canvas");
const { Board } = require("./Board");
const { Ply } = require("./Ply");
const { itoa } = require("./Square");

const { roundRect } = require("./roundRect");

const squareSizes = {
  xs: 25,
  sm: 50,
  md: 100,
  lg: 200,
  xl: 400
};

const defaults = {
  size: "md",
  axisLabels: true,
  flatCounts: true,
  pieceShadows: true,
  showRoads: true,
  unplayedPieces: true,
  padding: true
};

const colors = {
  bg: "#607d8b",
  unplayedBg: "#78909c",
  squareDark: "#8ca1ab",
  squareLight: "#90a4ae",
  turnIndicator: "#8bc34a",
  pieceShadow: "rgba(0, 0, 0, 0.15)",
  currentSquare: "rgba(139, 195, 74, 0.4)",
  primarySquare: "rgba(139, 195, 74, 0.75)",
  player: {
    1: {
      header: "#cfd8dc",
      flat: "#cfd8dc",
      special: "#eceff1",
      square: "rgba(207, 216, 220, 0.35)",
      connection: "rgba(207, 216, 220, 0.2)",
      road: "rgba(207, 216, 220, 0.8)",
      stroke: "rgba(84, 110, 122, 0.5)",
      border: "#546e7a"
    },
    2: {
      header: "#263238",
      flat: "#546e7a",
      special: "#455a64",
      square: "rgba(69, 90, 100, 0.35)",
      connection: "rgba(69, 90, 100, 0.2)",
      road: "rgba(69, 90, 100, 0.8)",
      stroke: "rgba(38, 50, 56, 0.5)",
      border: "#263238"
    }
  }
};

function limitText(ctx, text, width) {
  const originalLength = text.length;
  const suffix = "...";
  if (width <= 0) {
    return "";
  }
  while (text.length && ctx.measureText(text + suffix).width >= width) {
    text = text.substring(0, text.length - 1);
  }
  return text + (text.length < originalLength ? suffix : "");
}

exports.TPStoCanvas = function(options) {
  for (let key in defaults) {
    if (options.hasOwnProperty(key)) {
      if (typeof defaults[key] === "boolean") {
        options[key] = options[key] !== "false";
      } else if (typeof defaults[key] === "number") {
        options[key] = Number(options[key]);
      }
    } else {
      options[key] = defaults[key];
    }
  }

  const board = new Board(options);
  if (!board || board.errors.length) {
    throw board.errors[0];
  }

  let hlSquares = [];
  if (options.ply) {
    hlSquares = new Ply(options.ply).squares;
  }

  // Dimensions
  const squareSize = squareSizes[options.size];
  const roadSize = Math.round(squareSize * 0.31);
  const pieceRadius = Math.round(squareSize * 0.05);
  const pieceSize = Math.round(squareSize * 0.5);
  const pieceSpacing = Math.round(squareSize * 0.07);
  const immovableSize = Math.round(squareSize * 0.15);
  const wallSize = Math.round(squareSize * 0.1875);
  const sideCoords = {
    N: [(squareSize - roadSize) / 2, 0],
    S: [(squareSize - roadSize) / 2, squareSize - roadSize],
    E: [squareSize - roadSize, (squareSize - roadSize) / 2],
    W: [0, (squareSize - roadSize) / 2]
  };

  const shadowBlur = Math.round(squareSize * 0.03);
  const shadowOffset = Math.round(squareSize * 0.02);
  const strokeWidth = Math.round(squareSize * 0.02);

  const fontSize = squareSize * 0.22;
  const padding = options.padding ? Math.round(fontSize * 0.5) : 0;

  const flatCounterHeight = options.flatCounts ? Math.round(fontSize * 2) : 0;
  const turnIndicatorHeight = options.flatCounts
    ? Math.round(fontSize * 0.5)
    : 0;
  const headerHeight = turnIndicatorHeight + flatCounterHeight;

  const axisSize = options.axisLabels ? Math.round(fontSize * 1.5) : 0;

  const boardRadius = Math.round(squareSize / 10);
  const boardSize = squareSize * board.size;
  const unplayedWidth = options.unplayedPieces
    ? Math.round(squareSize * 1.75)
    : 0;

  const canvasWidth = unplayedWidth + axisSize + boardSize + padding * 2;
  const canvasHeight = headerHeight + axisSize + boardSize + padding * 2;

  // Start Drawing
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext("2d");
  ctx.font = fontSize + "px sans";
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Header
  if (options.flatCounts) {
    const totalFlats = board.flats[0] + board.flats[1];
    const flats1Width = Math.round(
      Math.min(
        boardSize - squareSize,
        Math.max(
          squareSize,
          (totalFlats ? board.flats[0] / totalFlats : 0.5) * boardSize
        )
      )
    );
    const flats2Width = boardSize - flats1Width;

    // Flat Bars
    ctx.fillStyle = colors.player[1].header;
    roundRect(
      ctx,
      padding + axisSize,
      padding,
      flats1Width,
      flatCounterHeight,
      { tl: boardRadius }
    );
    ctx.fill();
    ctx.fillStyle = colors.player[2].header;
    roundRect(
      ctx,
      padding + axisSize + flats1Width,
      padding,
      flats2Width,
      flatCounterHeight,
      { tr: boardRadius }
    );
    ctx.fill();

    // Flat Counts
    ctx.fillStyle = colors.player[2].header;
    ctx.textBaseline = "middle";
    // Player 1 Name
    if (options.player1) {
      const flatCount1Width = ctx.measureText(board.flats[0]).width;
      options.player1 = limitText(
        ctx,
        options.player1,
        flats1Width - flatCount1Width - fontSize * 1.2
      );
      ctx.textAlign = "start";
      ctx.fillText(
        options.player1,
        padding + axisSize + fontSize / 2,
        padding + flatCounterHeight / 2
      );
    }
    // Player 1 Flat Count
    ctx.textAlign = "end";
    ctx.fillText(
      board.flats[0],
      padding + axisSize + flats1Width - fontSize / 2,
      padding + flatCounterHeight / 2
    );

    ctx.fillStyle = colors.player[1].header;
    // Player 2 Name
    if (options.player2) {
      const flatCount2Width = ctx.measureText(board.flats[1]).width;
      options.player2 = limitText(
        ctx,
        options.player2,
        flats2Width - flatCount2Width - fontSize * 1.2
      );
      ctx.textAlign = "end";
      ctx.fillText(
        options.player2,
        padding + axisSize + boardSize - fontSize / 2,
        padding + flatCounterHeight / 2
      );
    }
    // Player 2 Flat Count
    ctx.textAlign = "start";
    ctx.fillText(
      board.flats[1],
      padding + axisSize + flats1Width + fontSize / 2,
      padding + flatCounterHeight / 2
    );

    // Turn Indicator
    ctx.fillStyle = colors.turnIndicator;
    ctx.fillRect(
      padding + axisSize + (board.player === 1 ? 0 : flats1Width),
      padding + flatCounterHeight,
      board.player === 1 ? flats1Width : flats2Width,
      turnIndicatorHeight
    );
  }

  // Axis Labels
  if (options.axisLabels) {
    ctx.fillStyle = colors.player[1].header;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < board.size; i++) {
      const coord = itoa(i, i);
      ctx.fillText(
        coord[0],
        padding + axisSize + squareSize * i + squareSize / 2,
        padding + headerHeight + boardSize + (axisSize + padding) / 2
      );
      ctx.fillText(
        coord[1],
        (axisSize + padding) / 2,
        padding +
          headerHeight +
          squareSize * (board.size - i - 1) +
          squareSize / 2
      );
    }
  }

  // Board
  ctx.fillStyle = colors.squareDark;
  ctx.fillRect(
    axisSize + padding,
    headerHeight + padding,
    boardSize,
    boardSize
  );

  // Square
  const drawSquare = square => {
    ctx.save();
    ctx.translate(
      padding + axisSize + square.x * squareSize,
      padding + headerHeight + (board.size - square.y - 1) * squareSize
    );

    if (square.isLight) {
      ctx.fillStyle = colors.squareLight;
      ctx.fillRect(0, 0, squareSize, squareSize);
    }

    if (hlSquares.includes(square.coord)) {
      if (hlSquares[0] === square.coord) {
        ctx.fillStyle = colors.primarySquare
      } else {
        ctx.fillStyle = colors.currentSquare
      }
      ctx.fillRect(0, 0, squareSize, squareSize);
    }

    if (options.showRoads && square.connected.length) {
      square.connected.forEach(side => {
        const coords = sideCoords[side];
        ctx.fillStyle =
          colors.player[square.color][
            square.roads[side] ? "road" : "connection"
          ];
        ctx.fillRect(coords[0], coords[1], roadSize, roadSize);
      });
    } else if (square.roads.length) {
      ctx.fillStyle = colors.player[square.color].square;
      ctx.fillRect(0, 0, squareSize, squareSize);
    }

    if (square.piece) {
      square.pieces.forEach(drawPiece);
      drawPiece(square.piece);
    }

    ctx.restore();
  };

  // Piece
  const drawPiece = piece => {
    ctx.save();

    const pieces = piece.square ? piece.square.pieces : null;
    const offset = squareSize / 2;
    ctx.translate(offset, offset);

    let y = 0;
    const z = piece.z();
    const isOverLimit = pieces && pieces.length > board.size;
    const isImmovable = isOverLimit && z < pieces.length - board.size;

    if (piece.square) {
      // Played
      y -= pieceSpacing * z;
      if (isOverLimit && !isImmovable) {
        y += pieceSpacing * (pieces.length - board.size);
      }
      if (piece.isStanding && pieces.length > 1) {
        y += pieceSpacing;
      }
    } else {
      // Unplayed
      const caps = board.pieceCounts[piece.color].cap;
      const total = board.pieceCounts[piece.color].total;
      y = board.size - 1;
      if (piece.isCapstone) {
        y *= total - piece.index - 1;
      } else {
        y *= total - piece.index - caps - 1;
      }
      y *= -squareSize / (total - 1);
    }

    if (options.pieceShadows) {
      ctx.shadowBlur = shadowBlur;
      ctx.shadowOffsetY = shadowOffset;
      ctx.shadowColor = colors.pieceShadow;
      ctx.strokeStyle = colors.player[piece.color].stroke;
    } else {
      ctx.strokeStyle = colors.player[piece.color].border;
    }
    ctx.lineWidth = strokeWidth;

    if (piece.isCapstone) {
      ctx.fillStyle = colors.player[piece.color].special;
      ctx.beginPath();
      ctx.arc(0, y, pieceSize / 2, 0, 2 * Math.PI);
    } else if (piece.isStanding) {
      ctx.fillStyle = colors.player[piece.color].special;
      ctx.translate(0, y);
      ctx.rotate(((piece.color === 1 ? -45 : 45) * Math.PI) / 180);
      roundRect(
        ctx,
        -wallSize / 2,
        -pieceSize / 2,
        wallSize,
        pieceSize,
        pieceRadius
      );
    } else {
      ctx.fillStyle = colors.player[piece.color].flat;
      if (isImmovable) {
        roundRect(
          ctx,
          pieceSize / 2,
          y + pieceSize / 2 - pieceSpacing,
          immovableSize,
          pieceSpacing,
          pieceRadius / 2
        );
      } else {
        roundRect(
          ctx,
          -pieceSize / 2,
          y - pieceSize / 2,
          pieceSize,
          pieceSize,
          pieceRadius
        );
      }
    }
    ctx.stroke();
    ctx.fill();

    ctx.restore();
  };

  board.squares.reverse().forEach(row => row.forEach(drawSquare));

  // Unplayed Pieces
  if (options.unplayedPieces) {
    ctx.fillStyle = colors.unplayedBg;
    roundRect(
      ctx,
      axisSize + padding + boardSize,
      headerHeight + padding,
      unplayedWidth,
      boardSize,
      { tr: boardRadius, br: boardRadius }
    );
    ctx.fill();

    [1, 2].forEach(color => {
      ctx.save();
      ctx.translate(
        padding +
          axisSize +
          boardSize +
          (color === 2) * (pieceSize + (squareSize - pieceSize) / 2),
        padding + headerHeight + boardSize - squareSize
      );
      ["flat", "cap"].forEach(type => {
        const total = board.pieceCounts[color][type];
        const played = board.pieces.played[color][type].length;
        const remaining = total - played;
        board.pieces.all[color][type]
          .slice(total - remaining)
          .reverse()
          .forEach(drawPiece);
      });
      ctx.restore();
    });
  }

  return canvas;
};
