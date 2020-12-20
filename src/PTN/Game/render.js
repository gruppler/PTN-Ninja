import { cloneDeep } from "lodash";
import { itoa } from "../Ply";

const squareSizes = {
  xs: 25,
  sm: 50,
  md: 100,
  lg: 200,
  xl: 400,
};

const defaults = {
  size: "md",
  axisLabels: true,
  turnIndicator: true,
  flatCounts: true,
  highlightSquares: true,
  pieceShadows: true,
  showRoads: true,
  unplayedPieces: true,
  includeNames: true,
  padding: true,
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
      border: "#546e7a",
    },
    2: {
      header: "#263238",
      flat: "#546e7a",
      special: "#455a64",
      square: "rgba(69, 90, 100, 0.35)",
      connection: "rgba(69, 90, 100, 0.2)",
      road: "rgba(69, 90, 100, 0.8)",
      stroke: "rgba(38, 50, 56, 0.5)",
      border: "#263238",
    },
  },
};

export default function render(game, options = {}) {
  options = cloneDeep(options);

  for (let key in defaults) {
    if (!options.hasOwnProperty(key)) {
      options[key] = defaults[key];
    }
  }

  let hlSquares = [];
  const ply = game.state.ply;
  if (options.highlightSquares && ply) {
    hlSquares = ply.squares;
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
    W: [0, (squareSize - roadSize) / 2],
  };

  const shadowBlur = Math.round(squareSize * 0.03);
  const shadowOffset = Math.round(squareSize * 0.02);
  const strokeWidth = Math.round(squareSize * 0.02);

  const fontSize = squareSize * 0.22;
  const padding = options.padding ? Math.round(fontSize * 0.5) : 0;

  const flatCounterHeight = options.turnIndicator
    ? Math.round(fontSize * 2)
    : 0;
  const turnIndicatorHeight = options.turnIndicator
    ? Math.round(fontSize * 0.5)
    : 0;
  const headerHeight = turnIndicatorHeight + flatCounterHeight;

  const axisSize = options.axisLabels ? Math.round(fontSize * 1.5) : 0;

  const boardRadius = Math.round(squareSize / 10);
  const boardSize = squareSize * game.size;
  const unplayedWidth = options.unplayedPieces
    ? Math.round(squareSize * 1.75)
    : 0;

  const canvasWidth = unplayedWidth + axisSize + boardSize + padding * 2;
  const canvasHeight = headerHeight + axisSize + boardSize + padding * 2;

  // Start Drawing
  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const ctx = canvas.getContext("2d");
  ctx.font = fontSize + "px Roboto";
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Header
  const flats = game.state.flats;
  if (options.turnIndicator) {
    const totalFlats = flats[0] + flats[1];
    const flats1Width = Math.round(
      Math.min(
        boardSize - squareSize,
        Math.max(
          squareSize,
          (options.flatCounts && totalFlats ? flats[0] / totalFlats : 0.5) *
            boardSize
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
    const offset = Math.round(fontSize * 0.1);
    // Player 1 Name
    let name1 =
      options.player1 || (game.tags.player1 ? game.tags.player1.value : "");
    if (options.includeNames && name1) {
      const flatCount1Width = ctx.measureText(flats[0]).width;
      name1 = limitText(
        ctx,
        name1,
        flats1Width - flatCount1Width - fontSize * 1.2
      );
      ctx.textAlign = "start";
      ctx.fillText(
        name1,
        padding + axisSize + fontSize / 2,
        padding + flatCounterHeight / 2 + offset
      );
    }
    // Player 1 Flat Count
    if (options.flatCounts) {
      ctx.textAlign = "end";
      ctx.fillText(
        flats[0],
        padding + axisSize + flats1Width - fontSize / 2,
        padding + flatCounterHeight / 2 + offset
      );
    }

    ctx.fillStyle = colors.player[1].header;
    // Player 2 Name
    let name2 =
      options.player2 || (game.tags.player2 ? game.tags.player2.value : "");
    if (options.includeNames && name2) {
      const flatCount2Width = ctx.measureText(flats[1]).width;
      name2 = limitText(
        ctx,
        name2,
        flats2Width - flatCount2Width - fontSize * 1.2
      );
      ctx.textAlign = "end";
      ctx.fillText(
        name2,
        padding + axisSize + boardSize - fontSize / 2,
        padding + flatCounterHeight / 2 + offset
      );
    }
    // Player 2 Flat Count
    if (options.flatCounts) {
      ctx.textAlign = "start";
      ctx.fillText(
        flats[1],
        padding + axisSize + flats1Width + fontSize / 2,
        padding + flatCounterHeight / 2 + offset
      );
    }

    // Turn Indicator
    const turn = game.state.turn;
    ctx.fillStyle = colors.turnIndicator;
    ctx.fillRect(
      padding + axisSize + (turn === 1 ? 0 : flats1Width),
      padding + flatCounterHeight,
      turn === 1 ? flats1Width : flats2Width,
      turnIndicatorHeight
    );
  }

  // Axis Labels
  if (options.axisLabels) {
    ctx.fillStyle = colors.player[1].header;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < game.size; i++) {
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
          squareSize * (game.size - i - 1) +
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
  const drawSquare = (square) => {
    ctx.save();
    ctx.translate(
      padding + axisSize + square.static.x * squareSize,
      padding + headerHeight + (game.size - square.static.y - 1) * squareSize
    );

    if (square.static.isLight) {
      ctx.fillStyle = colors.squareLight;
      ctx.fillRect(0, 0, squareSize, squareSize);
    }

    if (hlSquares.includes(square.static.coord)) {
      if (hlSquares[0] === square.static.coord) {
        ctx.fillStyle = colors.primarySquare;
      } else {
        ctx.fillStyle = colors.currentSquare;
      }
      ctx.fillRect(0, 0, squareSize, squareSize);
    }

    if (options.showRoads && square.connected.length) {
      square.connected.forEach((side) => {
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
  const drawPiece = (piece) => {
    ctx.save();

    const pieces = piece.square ? piece.square.pieces : null;
    const offset = squareSize / 2;
    ctx.translate(offset, offset);

    let y = 0;
    const z = piece.z;
    const isOverLimit = pieces && pieces.length > game.size;
    const isImmovable = isOverLimit && z < pieces.length - game.size;

    if (piece.square) {
      // Played
      y -= pieceSpacing * z;
      if (isOverLimit && !isImmovable) {
        y += pieceSpacing * (pieces.length - game.size);
      }
      if (piece.isStanding && pieces.length > 1) {
        y += pieceSpacing;
      }
    } else {
      // Unplayed
      const caps = game.pieceCounts[piece.color].cap;
      const total = game.pieceCounts[piece.color].total;
      y = game.size - 1;
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
    } else if (piece.square && piece.isStanding) {
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

  game.state.squares
    .concat()
    .reverse()
    .forEach((row) => row.forEach(drawSquare));

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

    [1, 2].forEach((color) => {
      ctx.save();
      ctx.translate(
        padding +
          axisSize +
          boardSize +
          (color === 2) * (pieceSize + (squareSize - pieceSize) / 2),
        padding + headerHeight + boardSize - squareSize
      );
      ["flat", "cap"].forEach((type) => {
        const total = game.pieceCounts[color][type];
        const played = game.state.pieces.played[color][type].length;
        const remaining = total - played;
        game.state.pieces.all[color][type]
          .slice(total - remaining)
          .concat()
          .reverse()
          .forEach(drawPiece);
      });
      ctx.restore();
    });
  }

  return canvas;
}

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

function roundRect(ctx, x, y, width, height, radius) {
  let radii = {
    tl: 0,
    tr: 0,
    bl: 0,
    br: 0,
  };
  if (typeof radius === "object") {
    for (let side in radius) {
      radii[side] = radius[side];
    }
  } else {
    for (let side in radii) {
      radii[side] = radius;
    }
  }

  ctx.beginPath();
  ctx.moveTo(x + radii.tl, y);
  ctx.lineTo(x + width - radii.tr, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radii.tr);
  ctx.lineTo(x + width, y + height - radii.br);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radii.br, y + height);
  ctx.lineTo(x + radii.bl, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radii.bl);
  ctx.lineTo(x, y + radii.tl);
  ctx.quadraticCurveTo(x, y, x + radii.tl, y);
  ctx.closePath();
}
