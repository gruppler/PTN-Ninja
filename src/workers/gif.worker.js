import { TPStoGIF } from "tps-ninja";

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

function toUint8Array(chunk) {
  if (chunk instanceof Uint8Array) {
    return chunk;
  }
  if (chunk instanceof ArrayBuffer) {
    return new Uint8Array(chunk);
  }
  if (chunk && chunk.buffer instanceof ArrayBuffer) {
    return new Uint8Array(
      chunk.buffer,
      chunk.byteOffset || 0,
      chunk.byteLength
    );
  }
  return new Uint8Array(chunk);
}

function combineChunks(chunks) {
  const totalSize = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const output = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

self.onmessage = async ({ data }) => {
  const { id, options } = data || {};
  if (!id || !options) {
    return;
  }

  try {
    ensureWorkerGlobals();
    const stream = TPStoGIF({
      ...options,
      onProgress(progress) {
        self.postMessage({ id, type: "progress", progress });
      },
    });

    const chunks = [];

    stream.on("data", (chunk) => {
      chunks.push(toUint8Array(chunk));
    });

    stream.on("end", () => {
      const bytes = combineChunks(chunks);
      self.postMessage(
        {
          id,
          type: "success",
          bytes: bytes.buffer,
          mimeType: "image/gif",
        },
        [bytes.buffer]
      );
    });

    stream.on("error", (error) => {
      self.postMessage({
        id,
        type: "error",
        error: error && error.message ? error.message : String(error),
      });
    });
  } catch (error) {
    self.postMessage({
      id,
      type: "error",
      error: error && error.message ? error.message : String(error),
    });
  }
};
