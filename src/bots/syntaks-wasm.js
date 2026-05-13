import Bot from "./bot";
import store from "../store";
import { pliesEqual } from "../Game/PTN/Ply";
import {
  searchPosition,
  sweepPosition,
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
      isInteractive: true,
      sizeHalfKomis: { 5: [0], 6: [0], 7: [0] },
      settings: {
        limitTypes: ["depth"],
        depth: 3,
        // When true, every tinue the engine proves at a ply's tpsBefore
        // is reflected as a `"` annotation on that ply. UI exposes this
        // toggle in the bot settings drawer.
        autoMarkTinue: true,
      },
      // Tinuë depth is always odd: an attacker-to-move position needs
      // an attacker→defender→...→attacker road sequence. Min 3 so we
      // skip the trivial 1-ply "just complete a road" case (auto-mark
      // ignores 1-ply anyway). Step 2 keeps the spinner on odd values.
      limitTypes: {
        depth: { min: 3, max: 99, step: 2 },
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

  // Komi is irrelevant to tinue search (forced road completion ignores
  // flat counts). Skip the base-class clamp so games with unusual komi
  // don't get the "unsupported komi" warning on every analyze.
  getSupportedHalfKomi() {
    return this.halfKomi;
  }

  // The wasm solve is synchronous in the worker — we don't get mid-search
  // progress, so reporting nps: 0 while running is misleading. Null it out
  // at search start; storeResults still computes the real nps from time +
  // nodes once the search completes.
  onSearchStart(state = {}) {
    super.onSearchStart({ ...state, nps: null });
  }

  // When marking a ply with `"`, Definition 3 of the formal Tinuë spec
  // requires the position BEFORE the ply to be in odd-ply Tinuë and the
  // played move to match a Tinuë sequence. The engine reports ALL root
  // attacker moves that win at the same depth via `winningFirstMoves`;
  // we mark any played ply that matches any of those winners.
  maybeAnnotate(tps, _plyID, winningFirstMoves, plies) {
    if (!this.settings.autoMarkTinue) return;
    if (!Array.isArray(winningFirstMoves) || winningFirstMoves.length === 0)
      return;
    // A 1-ply "Tinuë" is just the side-to-move completing a road on
    // their next ply — that's a regular road win, not a tinue in the
    // PTN-annotation sense. Only mark `"` for forced sequences that
    // actually require defender plies.
    if (plies <= 1) return;
    const game = this.game;
    if (!game || !game.ptn || !game.ptn.allPlies) return;
    // The analyze flow calls searchPosition for both each ply's
    // tpsBefore and tpsAfter, with the same plyID for both, so we can't
    // rely on plyID alone to identify the "preceding" relationship.
    // Find every ply (across branches) whose tpsBefore equals this
    // position, and mark the ones whose first move matches ANY of the
    // engine's reported winning first moves. game.ptn.allPlies entries
    // are ply outputs (plain objects), not Ply instances — use the
    // standalone pliesEqual which accepts both shapes plus PTN strings.
    const allPlies = game.ptn.allPlies;
    for (let i = 0; i < allPlies.length; i++) {
      const ply = allPlies[i];
      if (!ply || ply.tpsBefore !== tps) continue;
      let matches = false;
      for (let j = 0; j < winningFirstMoves.length; j++) {
        if (pliesEqual(ply, winningFirstMoves[j])) {
          matches = true;
          break;
        }
      }
      if (!matches) continue;
      store.commit("game/ADD_TINUE_ANNOTATION", ply.id);
    }
  }

  // Iterate plies back-to-front: late positions are usually simpler and
  // prove fast on their own, then their TT entries seed the searches at
  // earlier positions. For full-game analysis we also exhaust the main
  // branch first (last main ply → first main ply), then sub-branches.
  // For full-branch analysis we reverse the supplied branch ordering.
  getPositionsToAnalyze(all = true, pliesOverride = null, options = {}) {
    const source = pliesOverride || this.getPlies(all);
    let ordered;
    if (all) {
      const main = [];
      const subs = [];
      for (const p of source) {
        if (!p) continue;
        if (p.branch === "") main.push(p);
        else subs.push(p);
      }
      ordered = [...main.reverse(), ...subs.reverse()];
    } else {
      ordered = source.filter(Boolean).slice().reverse();
    }
    return super.getPositionsToAnalyze(all, ordered, options);
  }

  // Auto-follow during a backward sweep. The base setState only dispatches
  // GO_TO_PLY when the new analyzingPly's id is greater than the previous,
  // assuming forward iteration; mirror that logic without the direction
  // check, then let super handle the rest. Super's forward-only check will
  // be false during a backward step, so it won't double-dispatch.
  setState(state) {
    if (state.analyzingPly && this.state.analyzingPly !== state.analyzingPly) {
      const currentTPS = store.state.game.position.tps;
      const previousAnalyzingTPS =
        this.state.analyzingPly && this.state.analyzingPly.tpsBefore;
      const analysisState = store.state.analysis;
      const isSelectedInToolbar =
        analysisState && analysisState.botID === this.id;
      const shouldAutoFollowSource =
        analysisState &&
        (!analysisState.preferSavedResults ||
          analysisState.analysisSource === "saved");
      if (
        isSelectedInToolbar &&
        shouldAutoFollowSource &&
        (previousAnalyzingTPS === currentTPS ||
          previousAnalyzingTPS === null) &&
        (this.state.isAnalyzingGame || this.state.isAnalyzingBranch)
      ) {
        store.dispatch("game/GO_TO_PLY", {
          plyID: state.analyzingPly.id,
          isDone: false,
        });
      }
    }
    super.setState(state);
  }

  // Tinue results are 0 / +100 / -100 — they don't carry the cp resolution
  // that drives ?/!/!! marks for evaluative engines, and feeding them into
  // the eval-mark calculation produces nonsense (every transition into or
  // out of a tinue position would look like a blunder/brilliancy). The
  // tinue mark `"` is the sole evaluative mark this engine contributes.
  calculateEvalMark() {
    return null;
  }

  // The base dedupeResultsByPly trims to this many entries; default is 1
  // when no MultiPV option is declared, which would collapse our N-winner
  // fan-out down to just the primary. The wasm `collect_root_winners`
  // already enumerates ALL winning first moves at the proven depth, so
  // declare the framework cap at 8 (matches the bot.js internal ceiling)
  // and let it surface every one. We don't expose this as a user-tunable
  // setting because the search always enumerates the same set.
  getConfiguredMultiPvCount() {
    return 8;
  }

  async searchPosition(size, halfKomi, tps, plyID) {
    const initialPlayer = Number(String(tps).split(" ")[1]);
    // Interactive mode lifts the user's depth cap so the engine searches
    // as deep as it can until the position changes or the user disables
    // interactive analysis. 99 is "effectively unlimited" for syntaks's
    // alpha-beta — searches at depth 11+ on dense 6x6 already exhaust
    // wall time, so the cap rarely binds in practice.
    const maxPlies = this.state.isInteractiveEnabled
      ? 99
      : Number(this.settings.depth) || 9;
    // Reuse the persistent TT when sweeping branch/game — late positions
    // seed the TT for earlier ones. A standalone analyze-position uses a
    // one-shot solve so the result depends only on the chosen budget.
    const isSweep = !!(
      this.state.isAnalyzingGame || this.state.isAnalyzingBranch
    );
    const solver = isSweep ? sweepPosition : searchPosition;

    const request = {
      kind: isSweep ? "sweep" : "solve",
      tps,
      size,
      max_plies: maxPlies,
    };
    this.onSend(request);

    const t0 = performance.now();
    let result;
    try {
      result = await solver(tps, size, { maxPlies });
    } catch (error) {
      // Cancellation propagates as "syntaks: cancelled" — suppress the
      // error toast for that path; the user initiated it.
      const message = String(error && error.message ? error.message : error);
      if (!/cancelled/i.test(message)) {
        this.onError(error);
      }
      return null;
    }
    const time = Math.round(performance.now() - t0);

    this.onReceive({
      tps,
      time,
      ...(result.tinue
        ? { tinue: true, plies: result.plies, nodes: result.nodes }
        : {
            tinue: false,
            aborted: !!result.aborted,
            searchedPlies: result.depthSearched,
            nodes: result.nodes,
          }),
    });

    if (result.tinue) {
      this.maybeAnnotate(
        tps,
        plyID,
        result.winningFirstMoves ||
          (result.pv && result.pv.length ? [result.pv[0]] : []),
        result.plies
      );
      // Per Grimm 2024 Definition 3: a position is in n-ply Tinuë when
      // some side can force a road win in n turns. Odd n means the
      // winner is the side to move; even n means the winner is the
      // opponent of the side to move. The wasm engine reports plies
      // from a search where attacker = stm, so a Tinue with even plies
      // here represents "defender's last move accidentally completes
      // attacker's road" or similar even-length sequences in syntaks's
      // counting — the side-to-move is still the eventual winner.
      // (See `search_defender` cand_plies = 1 case.)
      //
      // For PTN-Ninja's eval bar, the absolute winner is always the
      // search's attacker, which is the side to move at this TPS.
      const winnerPlayer = initialPlayer;
      const evaluation = winnerPlayer === 1 ? 100 : -100;
      const rawCp = winnerPlayer === 1 ? 10000 : -10000;
      // Emit one suggestion per winning first move so the results panel
      // shows every alternative. The primary PV gets the engine's full
      // continuation; alternates only have their first move (the engine
      // collected the set of winners but didn't compute full PVs for
      // them — see `collect_root_winners` in the Rust side).
      const winners =
        Array.isArray(result.winningFirstMoves) &&
        result.winningFirstMoves.length > 0
          ? result.winningFirstMoves
          : result.pv && result.pv.length
          ? [result.pv[0]]
          : [];

      const primaryFirstMove =
        result.pv && result.pv.length ? result.pv[0] : null;
      const suggestions = winners.map((winner) => {
        const isPrimary = winner === primaryFirstMove;
        return {
          pv: isPrimary ? result.pv : [winner],
          time,
          depth: result.plies,
          // Node count is the full search budget — attribute it only to
          // the primary so summed engine-drawer node totals stay sane.
          nodes: isPrimary ? result.nodes : 0,
          evaluation,
          rawCp,
          // Tinue is by definition a forced road win, so use the R prefix.
          scoreText: `R${result.plies}`,
        };
      });

      return { tps, suggestions };
    }

    // NB: returning null instead of an empty-suggestions object intentionally
    // skips storeResults — storing [] would later trip getPositionsToAnalyze
    // on this.positions[tps][0].hash. Per-position cache state is tracked by
    // tinue-annotator's JS cache instead. The engine log captures the run
    // via onSend/onReceive above so the user can still see we searched.
    return null;
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
