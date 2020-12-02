const { createCanvas } = require("canvas");
const { Board } = require("./Board");

exports.TPStoPNG = function(options) {
  const board = new Board(options);
  if (!board || board.errors.length) {
    throw board.errors[0];
  }

  const canvas = createCanvas(500, 14);
  const ctx = canvas.getContext("2d");

  ctx.font = "12px sans";
  ctx.fillText(options.tps, 0, 12);

  return canvas;
};
