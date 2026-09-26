// Shared geometry for the arrows drawn over the board, used by both the
// analysis move visualizations and the user's drawn annotations so the two
// always look alike.

const START_SHORTEN = 0.3;
const END_SHORTEN = 0.15;
const HEAD_LEN = 0.2;
const HEAD_HALF = 0.1;
const SHAFT_START_INSET = 0.05;
const LANE_SPACING = 0.22;
const STACK_SPACING = 0.07; // 7% of square size

export const ARROW_STROKE_WIDTH = 0.08;

// Assigns overlapping arrows to parallel lanes so they fan out side by side
// instead of stacking on top of each other. Each item must provide the
// squares it passes over (in order) and whether it runs horizontally.
// Returns a Map of item => { index, groupSize }.
export function groupOverlappingArrows(items, getSquares, isHorizontal) {
  const result = new Map();

  function getEdges(item) {
    const sqs = getSquares(item) || [];
    const edges = new Set();
    for (let i = 0; i < sqs.length - 1; i++) {
      const a = sqs[i];
      const b = sqs[i + 1];
      edges.add(a < b ? a + "-" + b : b + "-" + a);
    }
    return edges;
  }

  const byAxis = {};
  items.forEach((item) => {
    const axis = isHorizontal(item) ? "h" : "v";
    if (!byAxis[axis]) byAxis[axis] = [];
    byAxis[axis].push(item);
  });

  for (const axis in byAxis) {
    const axisArrows = byAxis[axis];
    const edgeSets = axisArrows.map(getEdges);

    const edgeToArrows = {};
    axisArrows.forEach((_, i) => {
      for (const e of edgeSets[i]) {
        if (!edgeToArrows[e]) edgeToArrows[e] = [];
        edgeToArrows[e].push(i);
      }
    });

    // Greedy lane assignment
    const lane = new Array(axisArrows.length).fill(-1);
    for (let i = 0; i < axisArrows.length; i++) {
      const usedLanes = new Set();
      for (const e of edgeSets[i]) {
        for (const j of edgeToArrows[e]) {
          if (j !== i && lane[j] >= 0) usedLanes.add(lane[j]);
        }
      }
      let l = 0;
      while (usedLanes.has(l)) l++;
      lane[i] = l;
    }

    for (let i = 0; i < axisArrows.length; i++) {
      let maxOnEdge = 1;
      for (const e of edgeSets[i]) {
        maxOnEdge = Math.max(maxOnEdge, edgeToArrows[e].length);
      }
      result.set(axisArrows[i], {
        index: lane[i],
        groupSize: maxOnEdge,
      });
    }
  }

  return result;
}

// How far the top of a square's stack rises visually on the 2D board, so an
// arrow ending on a tall stack isn't swallowed by the pieces drawn on it.
export function stackTopOffset(square, boardPieces, boardSize) {
  if (!square || !square.pieces || !square.pieces.length) {
    return 0;
  }
  const stackHeight = square.pieces.length;
  const topRef = square.piece || square.pieces[stackHeight - 1];
  const topPiece = typeof topRef === "string" ? boardPieces[topRef] : topRef;
  const topIsWall =
    !!topPiece &&
    (topPiece.isStanding ||
      topPiece.typeCode === "S" ||
      topPiece.type === "wall");
  // Stacks taller than boardSize overflow (top piece clamps at boardSize-1 levels).
  const effectiveTop = Math.min(stackHeight - 1, boardSize - 1);
  // Wall stacks are lowered by one STACK_SPACING in 2D, so subtract it.
  let offset = STACK_SPACING * effectiveTop;
  if (topIsWall && stackHeight > 1) {
    offset -= STACK_SPACING;
  }
  return Math.max(0, offset);
}

// How far to lift an arrow off the 3D board so it clears the tallest stack
// it passes over. Returns a style object for the arrow's layer.
export function arrow3DStyle(squares, boardSquares) {
  let maxHeight = 0;
  squares.forEach((coord) => {
    const sq = boardSquares[coord];
    if (sq && sq.pieces) {
      maxHeight = Math.max(maxHeight, sq.pieces.length);
    }
  });
  if (maxHeight > 0) {
    const z = (maxHeight - 1) / 5 + 0.15;
    return { transform: `translateZ(calc(var(--square-size) * ${z}))` };
  }
  return {};
}

// Computes the shaft and head of an arrow between two points in board SVG
// space (one unit per square, y pointing down).
//
// fromStack/toStack: the 2D stack offsets of the start and end squares. Only
//   the one lower on screen is applied, and only for arrows that run
//   vertically on screen, since that's the only case where the pieces
//   overlap the arrow.
// indexInGroup/groupSize: the arrow's lane from groupOverlappingArrows.
export function arrowGeometry({
  from,
  to,
  fromStack = 0,
  toStack = 0,
  indexInGroup = 0,
  groupSize = 1,
}) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return null;
  const ndx = dx / len;
  const ndy = dy / len;

  // Perpendicular offset for grouped arrows
  let perpOffset = 0;
  if (groupSize > 1) {
    perpOffset = (-(groupSize - 1) / 2 + indexInGroup) * LANE_SPACING;
  }
  const px = -ndy;
  const py = ndx;
  const ox = px * perpOffset;
  const oy = py * perpOffset;

  // SVG y increases downward, so larger y = visually lower
  const isVerticalOnScreen = Math.abs(dy) > Math.abs(dx);
  let sourceAdvance = START_SHORTEN;
  let endShorten = END_SHORTEN;
  if (isVerticalOnScreen) {
    if (from.y > to.y) {
      // Arrow points up, from is lower - offset the source end
      sourceAdvance += fromStack;
    } else {
      // Arrow points down, to is lower - offset the destination end
      endShorten += toStack;
    }
  }

  // Tip of the arrowhead
  const tipX = to.x - ndx * endShorten + ox;
  const tipY = to.y - ndy * endShorten + oy;
  // Base center of the arrowhead
  const baseX = tipX - ndx * HEAD_LEN;
  const baseY = tipY - ndy * HEAD_LEN;

  // Line stops at arrowhead base. Clamp its start so a short arrow over a
  // tall stack can't invert its shaft.
  const baseDist = len - endShorten - HEAD_LEN;
  const shaftStart = Math.max(
    0,
    Math.min(sourceAdvance + SHAFT_START_INSET, baseDist)
  );
  const x1 = from.x + ndx * shaftStart + ox;
  const y1 = from.y + ndy * shaftStart + oy;

  // Arrowhead wing points (perpendicular to direction)
  const lx = baseX + px * HEAD_HALF;
  const ly = baseY + py * HEAD_HALF;
  const rx = baseX - px * HEAD_HALF;
  const ry = baseY - py * HEAD_HALF;

  return {
    ndx,
    ndy,
    px,
    py,
    ox,
    oy,
    sourceAdvance,
    x1,
    y1,
    x2: baseX,
    y2: baseY,
    tipX,
    tipY,
    baseX,
    baseY,
    headPoints: `${tipX},${tipY} ${lx},${ly} ${rx},${ry}`,
  };
}
