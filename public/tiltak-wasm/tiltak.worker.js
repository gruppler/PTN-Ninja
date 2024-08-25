importScripts("./tiltak_wasm.js");

const { start_engine } = wasm_bindgen;

async function init_wasm_in_worker() {
  await wasm_bindgen("./tiltak_wasm_bg.wasm");

  const callback = start_engine((result) => {
    self.postMessage(result);
  });

  callback("tei");

  self.onmessage = async ({ data }) => {
    callback(data);
  };
}

init_wasm_in_worker();
