// Renders an "Evaluation Graph" PNG matching the Python/matplotlib output of
// https://github.com/ViliamVadocz/tak/blob/main/graph.py
//
// Inputs:
//   evaluations:  Array<number|null>  one entry per ply; values in [-1, 1]
//                                     (player1 perspective). null = no data.
//   widthPerPly:  number   pixels per ply (default 20, matching 0.2" at 100dpi)
//   height:       number   total canvas height in pixels (default 500)
//   colors:       overrides for the default palette
//   title/xlabel/ylabel: text strings
//
// Returns:        HTMLCanvasElement (synchronously). Use canvas.toBlob(...)
//                 to get a PNG blob.

const DEFAULTS = {
  widthPerPly: 20,
  height: 500,
  colors: {
    figure: "#ffffff", // outer figure background
    background: "#404040", // axes facecolor (matches BACKGROUND in graph.py)
    line: "#fb8b24", // EVALUATION color in graph.py
    white: "#ffffff",
    black: "#000000",
    midline: "#808080", // matplotlib "gray"
    text: "#000000",
    spine: "#000000",
  },
  title: "Evaluation Graph",
  xlabel: "Move Number",
  ylabel: "Evaluation",
};

// Map a player1-perspective evaluation (-1..+1) onto a y-pixel.
// Y axis goes from -1 (bottom, 0%) to +1 (top, 100%).
function makeYToPx(plotTop, plotHeight) {
  return (v) => plotTop + ((1 - v) / 2) * plotHeight;
}

export function renderEvaluationGraphCanvas(opts = {}) {
  const cfg = {
    ...DEFAULTS,
    ...opts,
    colors: { ...DEFAULTS.colors, ...(opts && opts.colors) },
  };

  const evals = Array.isArray(cfg.evaluations) ? cfg.evaluations : [];
  const plies = evals.length;
  if (plies < 1) {
    throw new Error("No evaluations available");
  }

  // Mimic matplotlib defaults at dpi=100 so proportions feel familiar.
  const dpi = 100;
  const ptToPx = dpi / 72;
  const titlePx = 14 * ptToPx;
  const labelPx = 12 * ptToPx;
  const tickPx = 10 * ptToPx;
  const pad = Math.round(6 * ptToPx);

  // Reserve outer figure margins for labels/ticks/title (tight_layout-ish).
  const marginLeft = Math.round(labelPx + tickPx * 3 + pad);
  const marginRight = Math.round(pad * 2);
  const marginTop = Math.round(titlePx + pad * 2);
  const marginBottom = Math.round(labelPx + tickPx + pad * 3);

  const plotWidth = Math.max(1, Math.round(cfg.widthPerPly * plies));
  const plotHeight = Math.max(1, cfg.height - marginTop - marginBottom);
  const totalWidth = plotWidth + marginLeft + marginRight;
  const totalHeight = cfg.height;

  const canvas =
    typeof OffscreenCanvas !== "undefined" && opts.useOffscreen
      ? new OffscreenCanvas(totalWidth, totalHeight)
      : document.createElement("canvas");
  canvas.width = totalWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext("2d");

  // Figure background (outside the axes)
  ctx.fillStyle = cfg.colors.figure;
  ctx.fillRect(0, 0, totalWidth, totalHeight);

  // Axes facecolor
  ctx.fillStyle = cfg.colors.background;
  ctx.fillRect(marginLeft, marginTop, plotWidth, plotHeight);

  // Coordinate transforms.
  // Each ply occupies a fixed-width slot [i, i+1] across the plot width.
  const xToPx = (i) => marginLeft + (i / plies) * plotWidth;
  const yToPx = makeYToPx(marginTop, plotHeight);
  const yMid = yToPx(0);

  // Midline (gray) at evaluation = 0
  ctx.strokeStyle = cfg.colors.midline;
  ctx.lineWidth = Math.max(1, 1.5 * ptToPx);
  ctx.beginPath();
  ctx.moveTo(marginLeft, yMid);
  ctx.lineTo(marginLeft + plotWidth, yMid);
  ctx.stroke();

  // Step-post fill bars: white above midline (eval > 0), black below (eval < 0).
  // graph.py draws fill_between with step="post" using b_evals and w_evals,
  // which is equivalent to a single rectangle per ply slot.
  for (let i = 0; i < plies; i++) {
    const v = evals[i];
    if (v === null || v === undefined || !Number.isFinite(v)) continue;
    const x0 = xToPx(i);
    const x1 = xToPx(i + 1);
    const yV = yToPx(v);
    if (v > 0) {
      ctx.fillStyle = cfg.colors.white;
      ctx.fillRect(x0, yV, x1 - x0, yMid - yV);
    } else if (v < 0) {
      ctx.fillStyle = cfg.colors.black;
      ctx.fillRect(x0, yMid, x1 - x0, yV - yMid);
    }
  }

  ctx.strokeStyle = cfg.colors.line;
  ctx.lineWidth = 1.5 * ptToPx;
  ctx.lineJoin = "miter";
  ctx.lineCap = "butt";
  ctx.beginPath();
  let started = false;
  for (let i = 0; i < plies; i++) {
    const v = evals[i];
    if (v === null || v === undefined || !Number.isFinite(v)) {
      started = false;
      continue;
    }
    const x0 = xToPx(i);
    const x1 = xToPx(i + 1);
    const yV = yToPx(v);
    if (!started) {
      ctx.moveTo(x0, yV);
      started = true;
    } else {
      // Vertical jump from previous segment's value at x0
      ctx.lineTo(x0, yV);
    }
    ctx.lineTo(x1, yV);
  }
  ctx.stroke();

  // Spines (axes border) -- matplotlib default is 0.8pt.
  // Stroke centered on the exact plot rectangle so tick marks at v=±1 and
  // move #1 line up with the visual middle of each spine edge.
  const spineWidth = Math.max(1, 0.8 * ptToPx);
  const tickLen = Math.max(3, 3.5 * ptToPx);
  const tickGap = Math.max(3, 3 * ptToPx);
  ctx.strokeStyle = cfg.colors.spine;
  ctx.lineWidth = spineWidth;
  ctx.strokeRect(marginLeft, marginTop, plotWidth, plotHeight);

  // Tick marks + labels on Y axis at 0%, 20%, ... 100%.
  // Internally evaluation is -1..+1, displayed as a percentage where 50% = 0.
  ctx.fillStyle = cfg.colors.text;
  ctx.font = `${tickPx}px sans-serif`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "right";
  ctx.strokeStyle = cfg.colors.spine;
  ctx.lineWidth = spineWidth;
  const yTicks = [0, 20, 40, 60, 80, 100];
  for (const t of yTicks) {
    const v = (t - 50) / 50; // 0..100 => -1..+1
    const y = yToPx(v);
    ctx.beginPath();
    ctx.moveTo(marginLeft, y);
    ctx.lineTo(marginLeft - tickLen, y);
    ctx.stroke();
    ctx.fillText(`${t}%`, marginLeft - tickLen - tickGap, y);
  }

  // Tick marks + labels on X axis at every full move number.
  // graph.py: x = 1 + arange(plies)/2; xticks = x[::2] -> integer move numbers
  // at the start of every full move (i.e. ply indices 0, 2, 4, ...).
  ctx.textBaseline = "top";
  ctx.textAlign = "center";
  const lastMove = Math.ceil(plies / 2);
  for (let move = 1; move <= lastMove; move++) {
    const plyIndex = (move - 1) * 2;
    if (plyIndex >= plies) break;
    const x = xToPx(plyIndex);
    ctx.beginPath();
    ctx.moveTo(x, marginTop + plotHeight);
    ctx.lineTo(x, marginTop + plotHeight + tickLen);
    ctx.stroke();
    ctx.fillText(String(move), x, marginTop + plotHeight + tickLen + tickGap);
  }

  // Y axis label (rotated 90° counter-clockwise, centered on the axis)
  ctx.save();
  ctx.translate(pad + labelPx / 2, marginTop + plotHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = cfg.colors.text;
  ctx.font = `${labelPx}px sans-serif`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText(cfg.ylabel, 0, 0);
  ctx.restore();

  // X axis label (centered horizontally, just above the bottom edge)
  ctx.fillStyle = cfg.colors.text;
  ctx.font = `${labelPx}px sans-serif`;
  ctx.textBaseline = "bottom";
  ctx.textAlign = "center";
  ctx.fillText(cfg.xlabel, marginLeft + plotWidth / 2, totalHeight - pad);

  // Title (centered horizontally, near the top of the figure)
  ctx.fillStyle = cfg.colors.text;
  ctx.font = `${titlePx}px sans-serif`;
  ctx.textBaseline = "top";
  ctx.textAlign = "center";
  ctx.fillText(cfg.title, marginLeft + plotWidth / 2, pad);

  return canvas;
}

export function renderEvaluationGraphPNG(opts = {}) {
  const canvas = renderEvaluationGraphCanvas(opts);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to render evaluation graph"));
    }, "image/png");
  });
}
