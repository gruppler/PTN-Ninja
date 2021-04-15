export default {
  get_tps_orientation,
  transform_tps,
  transposed_transform_tps,
  transform_move,
  transposed_transform_move,
};

function flip_tps(tps) {
  let spl = tps.split("/");
  spl.reverse();
  let res = spl.join("/");
  return res;
}

function rotate_mat(board) {
  let result = [];
  let l = board[0].length;
  for (let i = 0; i < l; i++) {
    let s = [];
    board.forEach((r) => {
      s.push(r[i]);
    });
    result.push(s);
  }
  result.reverse();
  return result;
}

function rotate_tps(tps) {
  tps = tps.replaceAll("x6", "x,x,x,x,x,x");
  tps = tps.replaceAll("x5", "x,x,x,x,x");
  tps = tps.replaceAll("x4", "x,x,x,x");
  tps = tps.replaceAll("x3", "x,x,x");
  tps = tps.replaceAll("x2", "x,x");

  let spl = tps.split("/");

  let board = [];

  for (let i = 0; i < spl.length; i++) {
    let s = spl[i].split(",");
    board.push(s);
  }

  board = rotate_mat(board);

  tps = board.map((x) => x.join(",")).join("/");

  tps = tps.replaceAll("x,x,x,x,x,x", "x6");
  tps = tps.replaceAll("x,x,x,x,x", "x5");
  tps = tps.replaceAll("x,x,x,x", "x4");
  tps = tps.replaceAll("x,x,x", "x3");
  tps = tps.replaceAll("x,x", "x2");

  return tps;
}

function get_tps_orientation(tps) {
  let o = 0;
  let best_tps = tps;
  let rot_tps = tps;

  for (let i = 1; i < 4; i++) {
    rot_tps = rotate_tps(rot_tps);
    if (rot_tps < best_tps) {
      o = i;
      best_tps = rot_tps;
    }
  }

  rot_tps = flip_tps(tps);
  if (rot_tps < best_tps) {
    o = 4;
    best_tps = rot_tps;
    for (let i = 5; i < 8; i++) {
      rot_tps = rotate_tps(rot_tps);
      if (rot_tps < best_tps) {
        o = i;
        best_tps = rot_tps;
      }
    }
  }
  return o;
}

function transform_tps(tps, orientation) {
  if (orientation > 3) {
    tps = flip_tps(tps);
    for (let i = 4; i < orientation; i++) {
      tps = rotate_tps(tps);
    }
  } else {
    for (let i = 0; i < orientation; i++) {
      tps = rotate_tps(tps);
    }
  }
  return tps;
}

function transposed_transform_tps(tps, orientation) {
  // TODO
  return tps;
}

function swapchars(s, a, b) {
  s = s.replaceAll(a, "z");
  s = s.replaceAll(b, a);
  s = s.replaceAll("z", b);
  return s;
}

function swapint(s) {
  return "" + (parseInt(s) * -1 + 7);
}

function rot_loc(location) {
  let c = location[0];
  let i = parseInt(location[1]);
  let newi = "" + ("abcdef".indexOf(c) + 1);
  let newc = "fedcba"[i - 1];
  return newc + newi;
}

function isLower(str) {
  return str === str.toLowerCase() && str !== str.toUpperCase();
}

function rotate_move(move) {
  // a1 -> f1
  // 3c2+12 -> 3e3<12
  move = move.replaceAll("+", "z");
  move = move.replaceAll(">", "+");
  move = move.replaceAll("-", ">");
  move = move.replaceAll("<", "-");
  move = move.replaceAll("z", "<");

  for (let i = 0; i < move.length; i++) {
    if (isLower(move[i])) {
      let res =
        move.substr(0, i) + rot_loc(move.substr(i, 2)) + move.substr(i + 2);
      return res;
    }
  }
}

function swapsquare(move) {
  for (let i = 0; i < move.length - 1; i++) {
    if (isLower(move[i])) {
      return move.substr(0, i + 1) + swapint(move[i + 1]) + move.substr(i + 2);
    }
  }
}

function transform_move(move, orientation) {
  if (orientation >= 4) {
    move = swapchars(move, "+", "-");
    move = swapsquare(move);
  }
  for (let i = 0; i < orientation; i++) {
    move = rotate_move(move);
  }
  return move;
}

function transposed_transform_move(move, orientation) {
  let orig = move;
  for (let i = orientation; i > (orientation >= 4 ? 4 : 0); i--) {
    move = rotate_move(move);
    move = rotate_move(move);
    move = rotate_move(move);
  }
  if (orientation >= 4) {
    move = swapchars(move, "+", "-");
    move = swapsquare(move);
  }
  return move;
}
