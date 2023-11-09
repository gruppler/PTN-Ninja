importScripts("./topaz_web.js");

const { evaluate } = wasm_bindgen;

async function init_wasm_in_worker() {
  await wasm_bindgen("./topaz_web_bg.wasm");

  self.onmessage = async ({ data: options }) => {
    try {
      // Evaluate
      console.log("Analyzing position:", options);
      let result = evaluate(
        options.depth,
        options.timeBudget,
        options.size,
        options.komi,
        options.tps
      );
      console.log(result);

      // Check result for errors
      let matches = result.match(
        /info depth (\d+) score cp (-?\d+) nodes (\d+) pv (.+)/
      );
      if (!matches) {
        throw result;
      }

      // Format result
      let [, depth, score, nodes, pv] = matches;
      const output = {
        ...options,
        depth: Number(depth),
        score: Number(score),
        nodes: Number(nodes),
        pv: pv.split(" "),
      };
      console.log(output);

      // Return result
      self.postMessage(output);
    } catch (error) {
      self.postMessage({ error });
    }
  };
}

init_wasm_in_worker();
