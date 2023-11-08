importScripts("./topaz_web.js");

const { evaluate } = wasm_bindgen;

async function init_wasm_in_worker() {
  await wasm_bindgen("./topaz_web_bg.wasm");

  self.onmessage = async ({ data: options }) => {
    console.log("Analyzing position:", options);
    const [result, depth, score, nodes, pv] = evaluate(
      options.depth,
      options.timeBudget,
      options.size,
      options.komi,
      options.tps
    ).match(/info depth (\d+) score cp (-?\d+) nodes (\d+) pv (.+)/);
    const output = {
      ...options,
      depth: Number(depth),
      score: Number(score),
      nodes: Number(nodes),
      pv: pv.split(" "),
    };
    console.log(result, output);
    self.postMessage(output);
  };
}

init_wasm_in_worker();
