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
  "ms",
  "nodes",
  "pv",
  "pvAfter",
  "visits",
];

export function getDepth(message) {
  let matches;

  matches = message.match(/(?:\/)([0-9]+)(?:\W|$)/m);
  if (matches) {
    return Number(matches[1]);
  }

  return null;
}

// Evaluation formats
const evalFormats = [
  {
    pattern: /(?:\W|^)([+-][.0-9]+)(?:\W|$)/,
    format: (v) => v * 100,
  },
  {
    pattern: /(?:\W|^)([.0-9]+)%(?:\W|$)/,
    format: (v) => v * 2 - 100,
  },
];

export function getEvaluation(message) {
  let matches;

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

  matches = message.match(/(?:\W|^)(([0-9.])+\s*m?s)(?:\W|$)/im);
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
  matches = message.match(
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
  matches = message.match(
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
  const match = message.match(/(?:^|\s)([!?]{1,2})(?=\s|$)/m);
  if (match) {
    const mark = match[1];
    // Only accept valid eval marks
    if (mark === "!!" || mark === "!" || mark === "??" || mark === "?") {
      return mark;
    }
  }
  return null;
}

export function getBotName(message) {
  // Engine name stored as name:"name" (e.g., '+0.12/15 name:"Tiltak" 1234 nodes')
  let matches = message.match(/name:"((?:[^"\\]|\\.)*)"/i);
  if (matches) {
    // Unescape any escaped quotes
    return matches[1].replace(/\\"/g, '"');
  }
  return null;
}

export default class Comment {
  constructor(notation) {
    const matchData = notation.match(/\{((@[^"}]+:)?([0-9]+:)?([^}]*))\}/);

    if (!matchData) {
      throw new Error("Invalid comment");
    }

    [this.ptn, this.contents, this.player, this.time, this.message] = matchData;

    this.time = this.time ? Number(this.time) : null;

    if (this.player) {
      this.player = this.player.substring(1);
      if (/[1|2]/.test(this.player)) {
        this.player = Number(this.player);
      }
    } else {
      this.player = null;
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
