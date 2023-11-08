importScripts("./topaz_web.js");

const { evaluate } = wasm_bindgen;

async function init_wasm_in_worker() {
  await wasm_bindgen("./topaz_web_bg.wasm");

  self.onmessage = async ({ data: tps }) => {
    console.log("Analyzing position:", tps);
    const [result, depth, score, nodes, pv] = evaluate(tps).match(
      /info depth (\d+) score cp (-?\d+) nodes (\d+) pv (.+)/
    );
    console.log(result);
    self.postMessage({
      tps,
      depth,
      score,
      nodes,
      pv,
    });
  };
}

init_wasm_in_worker();
