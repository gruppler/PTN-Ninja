importScripts("./tiltak_wasm.js");

const { start_engine } = wasm_bindgen;

function init_wasm_in_worker() {
  // Object form, not a bare path: wasm-bindgen deprecated positional args
  // to the init function and warns on every load otherwise.
  return wasm_bindgen({ module_or_path: "./tiltak_wasm_bg.wasm" }).then(() => {
    const callback = start_engine((result) => {
      self.postMessage(result);
    });

    callback("tei");

    self.onmessage = ({ data }) => {
      callback(data);
    };
  });
}

init_wasm_in_worker();
