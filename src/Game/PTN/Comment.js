import Ply from "./Ply";
import { pick } from "lodash";

const outputProps = [
  "time",
  "player",
  "message",
  "depth",
  "evaluation",
  "ms",
  "nodes",
  "pv",
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

  matches = message.match(
    /(?:\W|^)(pv([=\s]+[1-8]?[CS]?[a-h][1-8]([<>+-][1-8]*)?[*'"?!]*)+)(?:\W|$)/gim
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

export function getVisits(message) {
  let matches;

  matches = message.match(/(?:\W|^)(([0-9]+)\s*visits)(?:\W|$)/im);
  if (matches) {
    return Number(matches[2]);
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

  get depth() {
    return getDepth(this.message);
  }

  get evaluation() {
    return getEvaluation(this.message);
  }

  get ms() {
    return getMS(this.message);
  }

  get nodes() {
    return getNodes(this.message);
  }

  get pv() {
    return getPV(this.message);
  }

  get visits() {
    return getVisits(this.message);
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
