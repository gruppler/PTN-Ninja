// Runs the syntaks TEI engine (an emscripten build, see README.md) in a worker.
//
// The engine reads TEI commands from stdin and prints replies to stdout. With
// PROXY_TO_PTHREAD its main() runs on a pthread, and emscripten services its
// stdio on this worker's thread - which must stay free to start the search
// threads, so it can't be the one waiting on input. Instead, stdin is a ring
// buffer in shared memory that the page writes to, and the engine's own
// thread reads it directly.
//
// This script is also what emscripten starts its pthreads from, so it does
// both jobs.
// Which build to run, from the query the page started this worker with (and
// which emscripten repeats for the threads it starts): "?relaxed" is the one
// built to use relaxed SIMD, for browsers that have it.
const variant =
  self.location.search === "?relaxed" ? "syntaks-relaxed" : "syntaks";
const CAPACITY = 1 << 20;
const HEADER = 16;
// [0] write index, [1] read index; the bytes follow
let sab = null;

if (self.name !== "em-pthread") {
  sab = new SharedArrayBuffer(HEADER + CAPACITY);

  // Give every pthread the buffer along with its startup message
  const Worker = self.Worker;
  self.Worker = class extends Worker {
    postMessage(message, transfer) {
      if (message && message.cmd === 1) {
        message = { ...message, stdin: sab };
      }
      super.postMessage(message, transfer);
    }
  };

  self.Module = {
    locateFile: (path) => path.replace(/^syntaks/, variant),
    print: (line) => self.postMessage(line),
    printErr: (line) => console.info("syntaks:", line),
  };

  // Hand the page the buffer to write commands into
  self.postMessage({ stdin: sab });
} else {
  self.addEventListener("message", ({ data }) => {
    if (data && data.stdin) sab = data.stdin;
  });
}

importScripts(`./${variant}.js`);

if (self.name === "em-pthread") {
  // fd_read for stdin, on the calling thread, blocking until there's input
  const readStdin = (iov, iovcnt, pnum) => {
    const state = new Int32Array(sab, 0, 2);
    const bytes = new Uint8Array(sab, HEADER);
    let write;
    let read;
    for (;;) {
      write = Atomics.load(state, 0);
      read = Atomics.load(state, 1);
      if (read !== write) break;
      Atomics.wait(state, 0, write);
    }

    growMemViews();
    let total = 0;
    for (let i = 0; i < iovcnt; i++) {
      const ptr = HEAPU32[(iov + i * 8) >> 2];
      const length = HEAPU32[(iov + i * 8 + 4) >> 2];
      let n = 0;
      while (n < length && read !== write) {
        HEAPU8[ptr + n++] = bytes[read];
        read = (read + 1) % CAPACITY;
      }
      total += n;
      if (read === write) break;
    }
    Atomics.store(state, 1, read);
    HEAPU32[pnum >> 2] = total;
    return 0;
  };

  const assign = assignWasmImports;
  assignWasmImports = () => {
    assign();
    for (const key of Object.keys(wasmImports)) {
      if (wasmImports[key] === _fd_read) {
        wasmImports[key] = (fd, iov, iovcnt, pnum) =>
          fd === 0
            ? readStdin(iov, iovcnt, pnum)
            : _fd_read(fd, iov, iovcnt, pnum);
      }
    }
  };
}
