import { TPStoPNG } from "tps-ninja";

// tps-ninja's browser canvas shim uses document.createElement("canvas"); in a
// worker there's no document, so back createCanvas with an OffscreenCanvas.
// (Mirrors gif.worker.js.) The render path draws shapes/text synchronously and
// loads no images, so no createImageBitmap shim is needed.
function ensureWorkerGlobals() {
  if (typeof self.document === "undefined") {
    self.document = {
      createElement(tag) {
        if (tag === "canvas") {
          return new OffscreenCanvas(1, 1);
        }
        if (tag === "img") {
          return {};
        }
        throw new Error(`Unsupported element in worker: ${tag}`);
      },
    };
  }
}

self.onmessage = async ({ data }) => {
  const { id, options } = data || {};
  if (!id || !options) {
    return;
  }

  try {
    ensureWorkerGlobals();
    const canvas = TPStoPNG(options);
    // OffscreenCanvas exposes convertToBlob() instead of HTMLCanvasElement's
    // toBlob(). Transfer the bytes back; the main thread makes the object URL
    // (a worker-created URL wouldn't be usable in the document).
    const blob = await canvas.convertToBlob({ type: "image/png" });
    const buffer = await blob.arrayBuffer();
    self.postMessage(
      { id, type: "success", bytes: buffer, mimeType: "image/png" },
      [buffer]
    );
  } catch (error) {
    self.postMessage({
      id,
      type: "error",
      error: error && error.message ? error.message : String(error),
    });
  }
};
