import { colors } from "quasar";
import { coordToXY, xyToCoord } from "./boardTransform";
import { isDark, isDarkDark } from "../themes";

// A drawn arrow is identified by its start/end pair, so any number of arrows
// may share a starting square as long as they end on different ones.
export function arrowKey(from, to) {
  return from + ">" + to;
}

export function findArrow(arrows, from, to) {
  const key = arrowKey(from, to);
  return arrows.findIndex((a) => arrowKey(a.from, a.to) === key);
}

// Tak has no diagonal movement, so a drawn arrow is snapped onto the rank or
// file of its starting square — whichever axis the drag leaned toward. The
// preview shows the snapped result, so the arrow is never a surprise.
// Returns null when the drag never left its starting square.
export function snapToOrthogonal(from, to) {
  const a = coordToXY(from);
  const b = coordToXY(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (!dx && !dy) {
    return null;
  }
  return Math.abs(dx) >= Math.abs(dy)
    ? xyToCoord(b.x, a.y)
    : xyToCoord(a.x, b.y);
}

const segmentCache = {};

// Every square the straight segment between two square centers passes over,
// including both endpoints. Used for erasing ("right-click anywhere on an
// arrow") and for lifting arrows above tall stacks in 3D.
export function squaresOnSegment(from, to, size) {
  const cacheKey = `${from}>${to}@${size}`;
  if (cacheKey in segmentCache) {
    return segmentCache[cacheKey];
  }
  const coords = computeSquaresOnSegment(from, to, size);
  segmentCache[cacheKey] = coords;
  return coords;
}

export function arrowTouchesSquare(arrow, coord, size) {
  if (arrow.from === coord || arrow.to === coord) {
    return true;
  }
  return squaresOnSegment(arrow.from, arrow.to, size).includes(coord);
}

function computeSquaresOnSegment(from, to, size) {
  const a = coordToXY(from);
  const b = coordToXY(to);
  const x1 = a.x + 0.5;
  const y1 = a.y + 0.5;
  const x2 = b.x + 0.5;
  const y2 = b.y + 0.5;
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(2, Math.ceil(dist * 64));
  const coords = [];
  const seen = {};
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.min(size - 1, Math.max(0, Math.floor(x1 + (x2 - x1) * t)));
    const y = Math.min(size - 1, Math.max(0, Math.floor(y1 + (y2 - y1) * t)));
    const coord = xyToCoord(x, y);
    if (!seen[coord]) {
      seen[coord] = true;
      coords.push(coord);
    }
  }
  return coords;
}

// Mirrors the theme's stone-border derivation so drawn arrows are outlined
// the same way the move-visualization arrows are.
export function annotationBorderColor(color) {
  try {
    return colors.lighten(
      color,
      isDarkDark(color) ? 35 : isDark(color) ? -50 : -35
    );
  } catch (error) {
    return "#000000";
  }
}
