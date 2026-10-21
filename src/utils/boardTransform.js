const COLUMNS = "abcdefgh";

function mod(n, m) {
  return ((n % m) + m) % m;
}

export function normalizeBoardTransform(transform = [0, 0]) {
  const rotate = mod(transform[0] || 0, 4);
  const flip = mod(transform[1] || 0, 2);
  return [rotate, flip];
}

export function transformBoardXY(x, y, size, transform = [0, 0]) {
  let [rotate, flip] = normalizeBoardTransform(transform);

  if (rotate === 1) {
    [x, y] = [y, size - 1 - x];
  } else if (rotate === 2) {
    x = size - 1 - x;
    y = size - 1 - y;
  } else if (rotate === 3) {
    [x, y] = [size - 1 - y, x];
  }

  if (flip) {
    x = size - 1 - x;
  }

  return { x, y };
}

export function transformDirection(direction, transform = [0, 0]) {
  if (!direction) return direction;

  const [rotate, flip] = normalizeBoardTransform(transform);
  let next = direction;

  if (rotate === 1) {
    next = { "+": ">", "-": "<", ">": "-", "<": "+" }[next];
  } else if (rotate === 2) {
    next = { "+": "-", "-": "+", ">": "<", "<": ">" }[next];
  } else if (rotate === 3) {
    next = { "+": "<", "-": ">", ">": "+", "<": "-" }[next];
  }

  if (flip) {
    next = { ">": "<", "<": ">" }[next] || next;
  }

  return next;
}

export function coordToXY(coord) {
  return {
    x: COLUMNS.indexOf(coord[0]),
    y: parseInt(coord.slice(1), 10) - 1,
  };
}

export function xyToCoord(x, y) {
  return `${COLUMNS[x]}${y + 1}`;
}

export function transformCoord(coord, size, transform = [0, 0]) {
  const { x, y } = coordToXY(coord);
  const transformed = transformBoardXY(x, y, size, transform);
  return {
    ...transformed,
    coord: xyToCoord(transformed.x, transformed.y),
  };
}
