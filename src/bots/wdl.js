import { isObject } from "lodash";

const toFiniteNumber = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string" && value.trim() === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const clampPercent = (value) => Math.max(0, Math.min(100, value));

export function normalizeWDL(wdl = null, evaluation = null) {
  let player1 = null;
  let draw = null;
  let player2 = null;

  if (isObject(wdl)) {
    if (Array.isArray(wdl)) {
      player1 = toFiniteNumber(wdl[0]);
      draw = toFiniteNumber(wdl[1]);
      player2 = toFiniteNumber(wdl[2]);
    } else {
      player1 = toFiniteNumber(
        wdl.player1 ?? wdl.p1 ?? wdl.win1 ?? wdl.wins1 ?? wdl.white ?? wdl.win
      );
      draw = toFiniteNumber(wdl.draw ?? wdl.draws ?? wdl.d);
      player2 = toFiniteNumber(
        wdl.player2 ?? wdl.p2 ?? wdl.win2 ?? wdl.wins2 ?? wdl.black ?? wdl.loss
      );
    }
  }

  if (player1 !== null || draw !== null || player2 !== null) {
    player1 = player1 || 0;
    draw = draw || 0;
    player2 = player2 || 0;
    const total = player1 + draw + player2;
    if (total > 0) {
      const player1Pct = clampPercent((100 * player1) / total);
      const drawPct = clampPercent((100 * draw) / total);
      const player2Pct = clampPercent(100 - player1Pct - drawPct);
      return {
        player1: player1Pct,
        draw: drawPct,
        player2: player2Pct,
      };
    }
  }

  const evalValue = toFiniteNumber(evaluation);
  if (evalValue === null) {
    return null;
  }
  const player1Pct = clampPercent((100 + evalValue) / 2);
  return {
    player1: player1Pct,
    draw: 0,
    player2: 100 - player1Pct,
  };
}
