import ThumbnailWorker from "worker-loader?name=js/thumbnail.worker.js!./thumbnail.worker.js";

let worker = null;
let requestID = 0;
let workerUnavailable = false;
const pending = new Map();

// The worker renders with OffscreenCanvas + convertToBlob; bail to the main
// thread when either isn't available (older browsers, or worker construction
// fails).
export function isThumbnailWorkerSupported() {
  return (
    !workerUnavailable &&
    typeof Worker !== "undefined" &&
    typeof OffscreenCanvas !== "undefined" &&
    typeof OffscreenCanvas.prototype.convertToBlob === "function"
  );
}

function getWorker() {
  if (workerUnavailable) {
    return null;
  }
  if (!worker) {
    try {
      worker = new ThumbnailWorker();
    } catch (error) {
      workerUnavailable = true;
      return null;
    }

    worker.onmessage = ({ data }) => {
      const { id, type, bytes, mimeType, error } = data || {};
      if (!id) {
        return;
      }
      const request = pending.get(id);
      if (!request) {
        return;
      }
      pending.delete(id);
      if (type === "success") {
        request.resolve(new Blob([bytes], { type: mimeType || "image/png" }));
      } else {
        request.reject(new Error(error || "Failed to render thumbnail"));
      }
    };

    worker.onerror = (event) => {
      // Fail outstanding requests and tear the worker down so the next call
      // recreates it (or the caller falls back to the main thread).
      pending.forEach(({ reject }) => {
        reject(new Error(event.message || "Thumbnail worker error"));
      });
      pending.clear();
      worker = null;
    };
  }

  return worker;
}

export function renderThumbnailInWorker(options) {
  const activeWorker = getWorker();
  if (!activeWorker) {
    return Promise.reject(new Error("Thumbnail worker unavailable"));
  }

  const id = `thumb-${Date.now()}-${requestID++}`;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    activeWorker.postMessage({ id, options });
  });
}

export function terminateThumbnailWorker() {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  pending.forEach(({ reject }) => {
    reject(new Error("Thumbnail worker terminated"));
  });
  pending.clear();
}
