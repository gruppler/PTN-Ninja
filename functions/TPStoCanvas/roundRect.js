// Adapted from Corgalore's answer:
// https://stackoverflow.com/a/7592676/1216718

exports.roundRect = function(ctx, x, y, width, height, radius) {
  let radii = {
    tl: 0,
    tr: 0,
    bl: 0,
    br: 0
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
};
