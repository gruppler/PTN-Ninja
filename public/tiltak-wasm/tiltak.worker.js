importScripts("./tiltak_wasm.js");

const { start_engine } = wasm_bindgen;

async function init_wasm_in_worker() {
  await wasm_bindgen("./tiltak_wasm_bg.wasm");

  let callback = start_engine((result) => {
    // console.log(`Received ${result} from engine`);

    self.postMessage(result);
  });

  callback("tei");

  self.onmessage = async ({ data: options }) => {
    console.log(`Received options ${JSON.stringify(options)}`);
    let { depth, timeBudget, size, komi, tps } = options;

    callback(`teinewgame ${size}`);
    callback(`setoption name HalfKomi value ${komi * 2}`);
    callback(`position tps ${tps}`);
    callback(`go infinite`);
  };
}

init_wasm_in_worker();
