import Bot from "./bot";
import {
  searchPosition,
  preload as preloadSyntaks,
  cancelAll as cancelAllSyntaks,
} from "./tinue-annotator";

export default class SyntaksWasm extends Bot {
  constructor(options = {}) {
    super({
      id: "syntaks",
      icon: "local",
      label: "analysis.engines.syntaks",
      description: "analysis.engines_description.syntaks",
      isInteractive: false,
      sizeHalfKomis: { 5: [0], 6: [0], 7: [0] },
      settings: {
        limitTypes: ["depth"],
        depth: 9,
      },
      limitTypes: {
        depth: {},
      },
      ...options,
    });

    this.preload();
  }

  preload() {
    try {
      preloadSyntaks();
      this.setState({ isReady: true });
      return true;
    } catch (error) {
      console.error("Failed to preload syntaks (wasm):", error);
      return false;
    }
  }

  reset() {
    this.setState({ isReady: false });
    super.reset();
    this.preload();
  }

  async searchPosition(size, halfKomi, tps) {
    const initialPlayer = Number(String(tps).split(" ")[1]);
    const maxPlies = Number(this.settings.depth) || 9;
    const hash = this.getSettingsHash();

    let result;
    try {
      result = await searchPosition(tps, size, { maxPlies });
    } catch (error) {
      this.onError(error);
      return { hash, tps, suggestions: [] };
    }

    if (result.tinue) {
      const evaluation = initialPlayer === 1 ? 100 : -100;
      const rawCp = initialPlayer === 1 ? 10000 : -10000;
      // Tinue is by definition a forced road win, so use the R prefix.
      // (The TEI normalizer would re-type T/W/L → R if the PV ended in
      // R-0/0-R, but emitting R directly avoids depending on that path.)
      return {
        hash,
        tps,
        suggestions: [
          {
            pv: result.pv,
            depth: result.plies,
            nodes: result.nodes,
            evaluation,
            rawCp,
            scoreText: `R${result.plies}`,
          },
        ],
      };
    }

    return {
      hash,
      tps,
      suggestions: [],
      // Read by the engine drawer to show "no tinue at depth N" / "search
      // aborted" instead of a generic empty-results state.
      tinueStatus: result.aborted
        ? { kind: "aborted", searchedPlies: result.depthSearched }
        : { kind: "no_tinue", searchedPlies: result.depthSearched },
    };
  }

  async terminate(state) {
    try {
      await cancelAllSyntaks();
      this.onTerminate(state);
    } catch (error) {
      this.onError(error);
    }
  }
}
