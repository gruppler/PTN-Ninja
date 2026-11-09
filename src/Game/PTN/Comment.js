import Ply from "./Ply";
import { pick } from "lodash";

export const USER_NOTE_PREFIX = "*";

const outputProps = [
  "time",
  "player",
  "message",
  "displayMessage",
  "isUserNote",
  "botName",
  "depth",
  "evalMark",
  "evaluation",
  "wdl",
  "rawCp",
  "scoreText",
  "ms",
  "nodes",
  "pv",
  "pvAfter",
  "visits",
  "clock1",
  "clock2",
];

// Remove any key:"..." attributes (e.g. name:"Tiltak 7s") from the message
// before scanning for stats. Otherwise free-form names can collide with the
// loose regexes used by getMS/getEvaluation/getDepth/getEvalMark/etc.
export function stripQuotedAttrs(message) {
  return message.replace(/[a-z][a-z0-9_]*:"(?:[^"\\]|\\.)*"/gi, "");
}

export function getDepth(message) {
  let matches;

  matches = stripQuotedAttrs(message).match(/(?:\/)([0-9]+)(?:\W|$)/m);
  if (matches) {
    return Number(matches[1]);
  }

  return null;
}

export function getWDL(message) {
  const matches = message.match(
    /(?:\W|^)wdl\s*[:=]\s*([+-]?[0-9]*\.?[0-9]+)\s*[,/]\s*([+-]?[0-9]*\.?[0-9]+)\s*[,/]\s*([+-]?[0-9]*\.?[0-9]+)(?:\W|$)/i
  );
  if (matches) {
    return {
      player1: Number(matches[1]),
      draw: Number(matches[2]),
      player2: Number(matches[3]),
    };
  }

  return null;
}

export function getRawCp(message) {
  const matches = message.match(/(?:\W|^)cp\s*[:=]\s*([+-]?[0-9]+)(?:\W|$)/i);
  if (matches) {
    return Number(matches[1]);
  }

  return null;
}

export function getScoreText(message) {
  const matches = message.match(
    /(?:\W|^)(?:score|term)\s*[:=]\s*([RFDTWL][0-9]*)(?:\W|$)/i
  );
  if (matches) {
    return matches[1].toUpperCase();
  }

  return null;
}

// Evaluation formats
const evalFormats = [
  {
    pattern:
      /(?:^|\s)(?!cp\s*[:=])([+-](?:\d+(?:\.\d+)?|\.\d+))(?:\s*\/\s*\d+)?(?=\s|$)/i,
    format: (v) => v * 100,
  },
  {
    pattern: /(?:\W|^)([.0-9]+)%(?:\W|$)/,
    format: (v) => v * 2 - 100,
  },
];

export function getEvaluation(message) {
  let matches;
  message = stripQuotedAttrs(message);

  for (let i = 0; i < evalFormats.length; i++) {
    matches = message.match(evalFormats[i].pattern);
    if (matches) {
      return Math.max(
        -100,
        Math.min(100, evalFormats[i].format(Number(matches[1])))
      );
    }
  }

  return null;
}

export function getMS(message) {
  let matches;

  matches = stripQuotedAttrs(message).match(
    /(?:\W|^)(([0-9.])+\s*m?s)(?:\W|$)/im
  );
  if (matches) {
    matches = matches[1];
    let ms = Number(matches.replace(/[^0-9.]+/, ""));
    if (!/ms$/i.test(matches)) {
      ms *= 1000;
    }
    return ms;
  }

  return null;
}

export function getNodes(message) {
  let matches;

  matches = message.match(/(?:\W|^)(([0-9]+)\s*nodes)(?:\W|$)/im);
  if (matches) {
    return Number(matches[2]);
  }

  return null;
}

export function getPV(message) {
  let matches;

  // Match old format: "pv " or "pv=" (NOT "pv>")
  matches = stripQuotedAttrs(message).match(
    /(?:\W|^)(pv(?![>])([=\s]+[1-8]?[CS]?[a-h][1-8]([<>+-][1-8]*)?[*'"?!]*)+)(?:\W|$)/gim
  );
  if (matches) {
    matches = matches.map((match) =>
      match
        .trim()
        .replace(/^pv[=\s]+/, "")
        .split(/\s+/)
    );
    return matches;
  }

  return null;
}

export function getPVAfter(message) {
  let matches;

  // Match new format: "pv>" (PV for position AFTER this ply)
  matches = stripQuotedAttrs(message).match(
    /(?:\W|^)(pv>(\s+[1-8]?[CS]?[a-h][1-8]([<>+-][1-8]*)?[*'"?!]*)+)(?:\W|$)/gim
  );
  if (matches) {
    matches = matches.map((match) =>
      match
        .trim()
        .replace(/^pv>\s*/, "")
        .split(/\s+/)
    );
    return matches;
  }

  return null;
}

// Per-ply clock remaining, stored while spectating a PlayTak game as e.g.
// "clock1:4:32" / "clock2:0:08.34" / "clock1:1:05:30". The final segment may
// carry decimal seconds. Returns the remaining time in milliseconds.
export function getClockMs(message, player) {
  const matches = stripQuotedAttrs(message).match(
    new RegExp(
      `(?:\\W|^)clock${player}\\s*[:=]\\s*(\\d+(?::\\d{1,2})*(?:\\.\\d+)?)(?:\\W|$)`,
      "i"
    )
  );
  if (!matches) {
    return null;
  }
  const parts = matches[1].split(":");
  let seconds = 0;
  for (let i = 0; i < parts.length; i++) {
    // Only the last segment may be fractional.
    const n =
      i === parts.length - 1 ? parseFloat(parts[i]) : parseInt(parts[i], 10);
    if (!Number.isFinite(n)) {
      return null;
    }
    seconds = seconds * 60 + n;
  }
  return Math.round(seconds * 1000);
}

export function getVisits(message) {
  let matches;

  matches = message.match(/(?:\W|^)(([0-9]+)\s*visits)(?:\W|$)/im);
  if (matches) {
    return Number(matches[2]);
  }

  return null;
}

export function getEvalMark(message) {
  // Match standalone eval marks: !! ! ?? ?
  // Must be at word boundary, not part of a ply notation like Ca1!!' or Ca1??
  // Look for eval marks that are NOT preceded by a board coordinate
  const match = stripQuotedAttrs(message).match(/(?:^|\s)([!?]{1,2})(?=\s|$)/m);
  if (match) {
    const mark = match[1];
    // Only accept valid eval marks
    if (mark === "!!" || mark === "!" || mark === "??" || mark === "?") {
      return mark;
    }
  }
  return null;
}

// The name:"..." token holding an engine name in a saved analysis note
const BOT_NAME_TOKEN = /name:"((?:[^"\\]|\\.)*)"/i;

// Make an engine name safe to store: braces would end the comment and line
// breaks would split it, so drop them. Surrounding whitespace is trimmed.
export function sanitizeBotName(name) {
  return String(name || "")
    .replace(/[{}\r\n]/g, "")
    .trim();
}

// Escape an engine name for the inside of name:"..."
export function escapeBotName(name) {
  return name.replace(/["\\]/g, "\\$&");
}

// The name:"..." token for an engine name, or "" for no name. Braces are
// dropped, so no name can break the PTN.
export function botNameToken(name) {
  name = sanitizeBotName(name);
  return name ? `name:"${escapeBotName(name)}"` : "";
}

export function unescapeBotName(escaped) {
  return escaped.replace(/\\(["\\])/g, "$1");
}

export function getBotName(message) {
  // Engine name stored as name:"name" (e.g., '+0.12/15 name:"Tiltak" 1234 nodes')
  let matches = message.match(BOT_NAME_TOKEN);
  if (matches) {
    return unescapeBotName(matches[1]);
  }
  return null;
}

// Return `message` with its engine name set to `name`. An existing name:"..."
// token is replaced in place; otherwise the token is prepended, as saved
// notes have it. An empty name removes the token.
export function setBotName(message, name) {
  const token = botNameToken(name);
  if (BOT_NAME_TOKEN.test(message)) {
    if (token) {
      return message.replace(BOT_NAME_TOKEN, () => token);
    }
    return message
      .replace(new RegExp(BOT_NAME_TOKEN.source + "\\s*", "i"), "")
      .trim();
  }
  return token ? `${token} ${message}` : message;
}

// Detect result-inferred eval notes (e.g., {+1} from game result)
// These have only an evaluation value with no engine-quality data
export const isResultInferredNote = (note, plyID, allPlies) => {
  const ply = allPlies && allPlies[plyID];
  if (!ply || !ply.result || ply.result.type === "1") return false;
  return (
    note.depth === null &&
    note.rawCp === null &&
    note.wdl === null &&
    note.nodes === null &&
    note.scoreText === null &&
    note.pv === null &&
    note.pvAfter === null
  );
};

export default class Comment {
  constructor(notation) {
    const matchData = notation.match(/\{((@[^"}:]+:)?([0-9]+:)?([^}]*))\}/);

    if (!matchData) {
      throw new Error("Invalid comment");
    }

    [this.ptn, this.contents, this.player, this.time, this.message] = matchData;

    this.time = this.time ? Number(this.time) : null;

    if (this.player) {
      // Drop the "@" and the trailing ":" of "@2:"
      this.player = this.player.slice(1, -1);
      if (/[1|2]/.test(this.player)) {
        this.player = Number(this.player);
      }
    } else {
      this.player = null;
    }

    // toString() separates a player or time prefix from the message with a
    // space; don't let it accumulate across round trips
    if (
      (this.player !== null || this.time !== null) &&
      this.message[0] === " "
    ) {
      this.message = this.message.substring(1);
    }
  }

  get isUserNote() {
    return this.message.startsWith(USER_NOTE_PREFIX);
  }

  get displayMessage() {
    return this.isUserNote
      ? this.message.slice(USER_NOTE_PREFIX.length)
      : this.message;
  }

  get depth() {
    return this.isUserNote ? null : getDepth(this.message);
  }

  get evaluation() {
    return this.isUserNote ? null : getEvaluation(this.message);
  }

  get wdl() {
    return this.isUserNote ? null : getWDL(this.message);
  }

  get rawCp() {
    return this.isUserNote ? null : getRawCp(this.message);
  }

  get scoreText() {
    return this.isUserNote ? null : getScoreText(this.message);
  }

  get ms() {
    return this.isUserNote ? null : getMS(this.message);
  }

  get nodes() {
    return this.isUserNote ? null : getNodes(this.message);
  }

  get pv() {
    return this.isUserNote ? null : getPV(this.message);
  }

  get pvAfter() {
    return this.isUserNote ? null : getPVAfter(this.message);
  }

  get visits() {
    return this.isUserNote ? null : getVisits(this.message);
  }

  get clock1() {
    return this.isUserNote ? null : getClockMs(this.message, 1);
  }

  get clock2() {
    return this.isUserNote ? null : getClockMs(this.message, 2);
  }

  get botName() {
    return this.isUserNote ? null : getBotName(this.message);
  }

  get evalMark() {
    return this.isUserNote ? null : getEvalMark(this.message);
  }

  get output() {
    const output = pick(this, outputProps);
    return Object.freeze(output);
  }

  static test(notation) {
    return /^\s*\{/.test(notation);
  }

  static parse(notation) {
    return new Comment(notation);
  }

  toString(options = {}) {
    let message = this.message;
    if (options.size && options.transform) {
      message = message.replace(
        /(^|\s+)[1-8]?[CS]?[a-h][1-8]([<>+-][1-8]*)?\*?/gi,
        (ptn) => {
          let prefix = ptn.match(/^\s*/)[0];
          ptn = Ply.parse(ptn).transform(options.size, options.transform);
          return `${prefix}${ptn}`;
        }
      );
    }
    return (
      "{" +
      (this.player ? "@" + this.player + ":" : "") +
      (this.time === null ? "" : `${this.time}:`) +
      (this.time !== null || this.player ? " " : "") +
      message +
      "}"
    );
  }
}
