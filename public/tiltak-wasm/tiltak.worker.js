importScripts("./tiltak_wasm.js");

const { start_engine } = wasm_bindgen;

function init_wasm_in_worker() {
  return wasm_bindgen("./tiltak_wasm_bg.wasm").then(() => {
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
