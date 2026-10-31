# Syntaks (wasm)

[syntaks](https://github.com/Ciekce/syntaks) built for the browser with
emscripten, from the `wasm` branch of
[JonathanHallstrom/syntaks](https://github.com/JonathanHallstrom/syntaks)
(`f321acf`, "proper simd128 support"). The engine is a TEI program that reads commands from
stdin and prints to stdout; `syntaks.worker.js` runs it in a worker and
`src/bots/syntaks-wasm.js` talks to it.

## Building

With the emscripten SDK on the path (`source ~/emsdk/emsdk_env.sh`) and a
nightly toolchain with `rust-src` and the `wasm32-unknown-emscripten` target:

```sh
RUSTFLAGS="-C target-feature=+atomics,+simd128 -C link-arg=-pthread -C link-arg=-sPROXY_TO_PTHREAD -C link-arg=-sALLOW_MEMORY_GROWTH=1" cargo +nightly build --release -Zbuild-std=std,panic_abort --target wasm32-unknown-emscripten
```

Copy `syntaks.js` and `syntaks.wasm` from
`target/wasm32-unknown-emscripten/release/` into this folder, unmodified.
`syntaks.worker.js` is ours.

`+simd128` selects the engine's SIMD evaluation code, about four times as fast as
without it. Every current browser supports it; `+relaxed-simd` would use a
faster dot product still, but fewer browsers do.

## Threads

The engine's search threads run on shared memory, so the page has to be
cross-origin isolated: `Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: credentialless` on every response (see
`quasar.conf.js` and `firebase.json`). Without it the engine isn't offered.

## stdin

emscripten services the engine's stdio on the worker's thread, which has to stay
free to start the search threads, so the engine can't wait for input there.
`syntaks.worker.js` instead gives the page a ring buffer in shared memory to
write commands to, and replaces `fd_read` for stdin on the engine's own thread
to read from it, blocking until there is input.
