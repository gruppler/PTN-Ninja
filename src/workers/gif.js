import GIFWorker from "worker-loader?name=js/gif.worker.js!./gif.worker.js";

let worker = null;
let requestID = 0;
const pending = new Map();

function getWorker() {
  if (!worker) {
    worker = new GIFWorker();

    worker.onmessage = ({ data }) => {
      const { id, type, progress, bytes, mimeType, error } = data || {};
      if (!id) {
        return;
      }

      const request = pending.get(id);
      if (!request) {
        return;
      }

      if (type === "progress") {
        if (request.onProgress) {
          request.onProgress(progress);
        }
        return;
      }

      pending.delete(id);
      if (type === "success") {
        request.resolve(new Blob([bytes], { type: mimeType || "image/gif" }));
      } else {
        request.reject(new Error(error || "Failed to generate GIF"));
      }
    };

    worker.onerror = (event) => {
      pending.forEach(({ reject }) => {
        reject(new Error(event.message || "GIF worker error"));
      });
      pending.clear();
      worker = null;
    };
  }

  return worker;
}

export function generateGIFInWorker(options, { onProgress } = {}) {
  const id = `gif-${Date.now()}-${requestID++}`;

  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    getWorker().postMessage({ id, options });
  });
}

export function terminateGIFWorker() {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  pending.forEach(({ reject }) => {
    reject(new Error("GIF worker terminated"));
  });
  pending.clear();
}
