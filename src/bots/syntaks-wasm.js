import Bot from "./bot";
import store from "../store";
import { pliesEqual } from "../Game/PTN/Ply";
import {
  sweepPosition,
  streamSearchPosition,
  scorePosition,
  preload as preloadSyntaks,
  cancelAll as cancelAllSyntaks,
} from "./tinue-annotator";

export default class SyntaksWasm extends Bot {
  constructor(options = {}) {
    super({
      id: "syntaks",
      icon: "annotate_tinue",
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

  // Convert a tinue-annotator result into the `{tps, suggestions}` bundle
  // shape that `storeResults` expects. Returns null when there's no tinue
  // to report (no_tinue / aborted). Shared between the streaming
  // progress callback and the final return value so the engine drawer
  // gets identical formatting for partial and final results.
  buildResultBundle(tps, result, time, initialPlayer) {
    if (!result || !result.tinue) return null;
    // Per Grimm 2024 Definition 3: a position is in n-ply Tinuë when
    // some side can force a road win in n turns. The wasm engine reports
    // plies from a search where attacker = stm, so the absolute winner
    // is always the side to move at this TPS.
    const winnerPlayer = initialPlayer;
    const evaluation = winnerPlayer === 1 ? 100 : -100;
    const rawCp = winnerPlayer === 1 ? 10000 : -10000;
    // Emit one suggestion per winning first move so the results panel
    // shows every alternative. The primary PV gets the engine's full
    // continuation; alternates only have their first move (the engine
    // collected the set of winners but didn't compute full PVs for them
    // — see `collect_root_winners` in the Rust side).
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
        // Node count is the full search budget — attribute it only to the
        // primary so summed engine-drawer node totals stay sane.
        nodes: isPrimary ? result.nodes : 0,
        evaluation,
        rawCp,
        // Tinue is by definition a forced road win, so use the R prefix.
        scoreText: `R${result.plies}`,
      };
    });
    return { tps, suggestions };
  }

  // Convert a per-move score_moves table into the `{tps, suggestions}`
  // bundle shape that `storeResults` expects. Each suggestion's eval is
  // pinned to the attacker's color (so the eval bar fills toward the
  // winning side regardless of stm), and the score label uses the
  // absolute-winner-coloured `R<plies>` convention rather than the
  // stm-relative W/L. Returns null if no move has a Win-equivalent
  // verdict against this attacker — caller falls through to a fresh
  // search.
  //
  // `scores` is the array returned by `scorePosition` (an entry per
  // legal move, each tagged with `kind` and optional `plies`/`searched`).
  // `attackerP1` flags whose perspective the scores were computed from.
  buildScoredBundle(tps, scores, attackerP1, time) {
    if (!Array.isArray(scores) || scores.length === 0) return null;
    const winnerPlayer = attackerP1 ? 1 : 2;
    const evaluation = winnerPlayer === 1 ? 100 : -100;
    const rawCp = winnerPlayer === 1 ? 10000 : -10000;

    // A `Win` verdict means the *attacker* forces a road win in `plies`
    // ply from before this move. A `Loss` verdict means the mover hands
    // the attacker a road on this very move (so plies = 1, still an
    // attacker win in absolute terms). Both render as `R<plies>` in the
    // attacker's color. NoWin/Flat/Unknown are not actionable suggestions
    // for a tinue display and get dropped.
    const winning = scores.filter((s) => s.kind === "win" || s.kind === "loss");
    if (winning.length === 0) return null;

    // Sort by plies ascending — shortest forced sequences first so the
    // primary suggestion is the fastest mate (or the move that hands
    // the road soonest). For defender-to-move positions this places
    // the weakest defense at the top; the UI can reverse if desired,
    // but matching "fastest win" semantics aligns with how the engine
    // already orders results elsewhere.
    winning.sort((a, b) => (a.plies || 0) - (b.plies || 0));

    const suggestions = winning.map((s) => ({
      pv: [s.move],
      time,
      depth: s.plies,
      // No fresh search ran — node count belongs to the original solve
      // that warmed the TT. Reporting 0 here keeps engine-drawer node
      // totals honest.
      nodes: 0,
      evaluation,
      rawCp,
      scoreText: `R${s.plies}`,
    }));
    return { tps, suggestions };
  }

  // Pure TT probe across both attacker perspectives. Returns the bundle
  // for whichever perspective lights up the most warm-TT entries, or
  // null if neither finds any actionable verdict. Used as the fast path
  // in searchPosition so navigating into a previously-proven tinue
  // subtree populates the results panel instantly without a fresh
  // search.
  async tryScoreShortCircuit(tps, size, t0) {
    let scoreP1, scoreP2;
    try {
      [scoreP1, scoreP2] = await Promise.all([
        scorePosition(tps, size, true),
        scorePosition(tps, size, false),
      ]);
    } catch (e) {
      return null;
    }
    const usefulCount = (arr) =>
      arr.filter((s) => s.kind === "win" || s.kind === "loss").length;
    const hitsP1 = usefulCount(scoreP1);
    const hitsP2 = usefulCount(scoreP2);
    if (hitsP1 === 0 && hitsP2 === 0) return null;
    const attackerP1 = hitsP1 >= hitsP2;
    const scores = attackerP1 ? scoreP1 : scoreP2;
    const time = Math.round(performance.now() - t0);
    return this.buildScoredBundle(tps, scores, attackerP1, time);
  }

  async searchPosition(size, halfKomi, tps, plyID) {
    const initialPlayer = Number(String(tps).split(" ")[1]);

    // Fast path: probe the warm TT for cached per-move verdicts. When
    // the user navigates inside an already-proven tinue subtree (e.g.,
    // by playing the engine's winning move and stepping into the
    // defender's response menu), every legal move is already labelled
    // in the TT and we can rebuild the results panel without a fresh
    // alpha-beta search. Falls through to the regular flow when the TT
    // has no relevant entries.
    if (!this.state.isAnalyzingGame && !this.state.isAnalyzingBranch) {
      const t0fast = performance.now();
      const fastBundle = await this.tryScoreShortCircuit(tps, size, t0fast);
      if (fastBundle && fastBundle.suggestions.length > 0) {
        const time = Math.round(performance.now() - t0fast);
        this.onSend({ kind: "score", tps, size });
        this.onReceive({
          tps,
          time,
          tinue: true,
          plies: fastBundle.suggestions[0].depth,
          nodes: 0,
          fromCache: true,
        });
        return fastBundle;
      }
    }

    // Interactive mode lifts the user's depth cap so the engine searches
    // as deep as it can until the position changes or the user disables
    // interactive analysis. 99 is "effectively unlimited" for syntaks's
    // alpha-beta — searches at depth 11+ on dense 6x6 already exhaust
    // wall time, so the cap rarely binds in practice.
    const maxPlies = this.state.isInteractiveEnabled
      ? 99
      : Number(this.settings.depth) || 9;
    // Sweep mode (analyze branch / game) uses the persistent-TT sweep
    // path: each position's search is short, so streaming overhead
    // wouldn't buy anything. Single-position analyses (manual or
    // interactive) stream per-depth via solve_at_depth so the user sees
    // shallow results first and watches the engine deepen.
    const isSweep = !!(
      this.state.isAnalyzingGame || this.state.isAnalyzingBranch
    );

    const request = {
      kind: isSweep ? "sweep" : "stream",
      tps,
      size,
      max_plies: maxPlies,
    };
    this.onSend(request);

    const t0 = performance.now();
    let result;
    try {
      if (isSweep) {
        result = await sweepPosition(tps, size, { maxPlies });
      } else {
        result = await streamSearchPosition(
          tps,
          size,
          { maxPlies },
          (partial) => {
            // Per-depth completion. Update visible engine state so the
            // toolbar ticks (time/nodes/nps) and the user sees the
            // engine deepening even when intermediate depths return
            // no_tinue. Push a provisional result if a tinue was found
            // at this depth; subsequent deeper iterations may refine the
            // multipv winners list as `collect_root_winners` finds more.
            const t = Math.round(performance.now() - t0);
            const partialNodes = Number(partial.nodes) || 0;
            const nps = t > 0 ? partialNodes / (t / 1000) : null;
            this.setState({
              time: t,
              nodes: partialNodes,
              nps,
            });
            this.onReceive({
              tps,
              time: t,
              depthCompleted: partial.depth,
              ...(partial.tinue
                ? {
                    tinue: true,
                    plies: partial.plies,
                    nodes: partial.nodes,
                  }
                : {
                    tinue: false,
                    aborted: !!partial.aborted,
                    searchedPlies: partial.depthSearched,
                    nodes: partial.nodes,
                  }),
            });
            const partialBundle = this.buildResultBundle(
              tps,
              partial,
              t,
              initialPlayer
            );
            if (partialBundle) {
              this.storeResults(partialBundle);
            }
          }
        );
      }
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
      return this.buildResultBundle(tps, result, time, initialPlayer);
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
