importScripts("./tiltak_wasm.js");

const { start_engine } = wasm_bindgen;

async function init_wasm_in_worker() {
  await wasm_bindgen("./tiltak_wasm_bg.wasm");

  const callback = start_engine((result) => {
    // console.log("from engine:", result, tps);
    self.postMessage(result);
  });

  self.onmessage = async ({ data }) => {
    // console.log("from ui:", data);
    callback(data);
  };
}

init_wasm_in_worker();
