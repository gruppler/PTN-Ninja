import Vue from "vue";
import Bot from "./bot";
import store from "../store";
import { pliesEqual } from "../Game/PTN/Ply";
import {
  sweepPosition,
  streamSearchPosition,
  scorePosition,
  findTinueOrigin,
  preload as preloadSolver,
  cancelAll as cancelAllSolver,
  clearAllCaches,
  SCOPE_FULL,
  SCOPE_TAK_CHAIN,
} from "./tinue-annotator";

// A per-move verdict that could ONLY have come from a warm TT entry.
//
// Only Wins with plies > 1 qualify. TT-stored win plies are always >= 1, so
// verdicts derived from the TT in score_moves are always >= 2; a
// Win{plies:1} instead comes from the immediate-road check on the move's
// resulting position, and says nothing about whether a deeper forced road
// exists here — only "this move creates a road right now". The regular
// search finds those trivially, so they don't justify the fast path.
//
// Loss entries are excluded for the same reason as in buildScoredBundle:
// they mark an attacker suicide, not a winning move.
const isWarmWin = (s) => s.kind === "win" && (s.plies || 0) > 1;
const countWarmWins = (arr) => arr.filter(isWarmWin).length;

// The "Tinuë Solver" analysis engine. Built on the syntaks engine by Ciekce
// (https://github.com/Ciekce/syntaks) — see the Tinuë Solver entry in usage.md
// for full attribution.
export default class TinueSolverBot extends Bot {
  constructor(options = {}) {
    super({
      id: "tinue-solver",
      icon: "annotate_tinue",
      label: "analysis.engines.tinue-solver",
      description: "analysis.engines_description.tinue-solver",
      isInteractive: true,
      sizeHalfKomis: { 5: [0], 6: [0], 7: [0] },
      settings: {
        limitTypes: ["depth", "nodes"],
        // Depth 11 proves ~97% of the 6x6 tinues in the labelled PlayTak
        // corpus (~92% across all sizes). Depth 3 reaches only 31%.
        depth: 11,
        // Per-position ceiling, sized to the 6x6 knee: 10k nodes resolves
        // 87% of 6x6 positions, 50k resolves 91.5%, and 500k adds 0.5
        // beyond that — the rest is a tail no budget clears. Its real job
        // is turning a runaway position into "aborted here, moving on"
        // rather than a sweep that stops dead on one ply.
        nodes: 50000,
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
        nodes: { min: 1e3, max: 1e8, step: 1e3 },
      },
      // Must be declared here, not assigned later: Vue can't observe a
      // key added to state after construction. `tinueVerdict` holds the
      // outcome of a search that proved nothing, which produces no
      // suggestions and so would otherwise leave the drawer
      // indistinguishable from idle. `tinueOrigin` is the in-progress walk
      // (spinner + examined count); `tinueOrigins` is where finished walks
      // land, keyed by every position they answer for.
      state: { tinueVerdict: null, tinueOrigin: null, tinueOrigins: {} },
      ...options,
    });

    this.preload();
  }

  preload() {
    try {
      preloadSolver();
      this.setState({ isReady: true });
      return true;
    } catch (error) {
      console.error("Failed to preload tinue-solver (wasm):", error);
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

  // Trace the current tinue back to the earliest position from which a
  // forced win already existed. Records the result without moving the
  // board; navigating there is the caller's choice.
  //
  // Works for wins that were *missed* in game, which is much of the point:
  // the walk solves each position and never asks what was played, so a
  // forced win the attacker overlooked is found exactly like one they took.
  //
  // Note what the result does and does not claim. It says a forced win
  // existed at every attacker turn from the origin onward — not that one
  // continuous line ran through them. If the attacker had a win, threw it
  // away, and the opponent later handed back a different one, both turns
  // are still genuinely forced, so the span is honest but the wins need
  // not be the same win.
  async findOrigin(plyID) {
    if (plyID == null || !this.game) {
      return null;
    }
    // The walk needs a Ply *instance*: it follows `parent` backward, which
    // the ply outputs in `position.ply` and `ptn.allPlies` do not carry.
    // Instances live on the Game object, reached the way the store getters
    // and mutations reach it — note that is not the same object as
    // `this.game`, which is the Vuex game state.
    const game = Vue.prototype.$game;
    const startPly = game && game.plies[plyID];
    if (!startPly || !startPly.tpsBefore) {
      return null;
    }
    const size = this.game.config && this.game.config.size;
    if (!size) {
      return null;
    }

    this.setState({ tinueOrigin: { searching: true, examined: 0 } });

    // Anchor the walk on the attacker, not on whoever happens to be to
    // move. See findOriginAnchor.
    const anchor = await this.findOriginAnchor(startPly, size);
    if (!anchor) {
      this.setState({ tinueOrigin: null });
      return null;
    }

    let result;
    try {
      result = await findTinueOrigin(
        anchor,
        size,
        {
          maxPlies: Number(this.settings.depth) || 9,
          maxNodes: Number(this.settings.nodes) || 0,
          // The origin is scope-relative, so it is traced under the same
          // scope the sweep marks with. A strict walk answers "when did
          // the tak-chain win become forced".
          scope: SCOPE_TAK_CHAIN,
        },
        ({ examined }) =>
          this.setState({ tinueOrigin: { searching: true, examined } })
      );
    } catch (error) {
      this.setState({ tinueOrigin: null });
      this.onError(error);
      return null;
    }

    if (!result) {
      this.setState({ tinueOrigin: null });
      return null;
    }

    // Recorded against every position the walk answers for — the span it
    // proved, plus the position the user ran it from (which may be the
    // defender-to-move position the anchor stepped back off of; the anchor
    // probe is what establishes that it belongs to the same forced win).
    // Not against the origin: the drawer shows the trace under the same
    // condition it shows that position's results, and navigating there is
    // the list item's job — running the search should not move the board
    // out from under the user.
    //
    // `status` applies to the whole span for the same reason the origin
    // does: an `unknown` boundary means "no later than this" for every
    // position on the chain, never a bare origin for the early ones.
    //
    // `originTps` travels with it so the drawer can confirm the recorded
    // plyID still means what it meant — ply ids are per-game, and this map
    // outlives a game switch.
    const entry = {
      status: result.status,
      examined: result.examined,
      scope: result.scope,
      plyID: result.originPly.id,
      originTps: result.originPly.tpsBefore,
    };
    const tinueOrigins = { ...this.state.tinueOrigins };
    for (const tps of [startPly.tpsBefore, ...result.span]) {
      tinueOrigins[tps] = entry;
    }
    this.setState({ tinueOrigins, tinueOrigin: null });

    return result;
  }

  // Which position should the walk start from?
  //
  // `findTinueOrigin` steps back a full turn at a time and solves each
  // position, and the solver always searches from the side to move — so the
  // walk traces the forced wins of whoever is on move at its start ply.
  // Run it from a position where the *defender* is to move (the attacker
  // has just played, which is exactly where the drawer lands after stepping
  // through a proven line) and it asks whether the losing player has a
  // forced win. The answer is normally no, the walk reads that as its
  // boundary, and it reports "the win became forced right here" — the one
  // answer that is wrong regardless of the position.
  //
  // So: if the side to move here has winning moves in the TT, they are the
  // attacker and the walk starts here. Otherwise, if the side that just
  // moved does, the defender is on move and the attacker's own last move is
  // one ply back — anchor there, and the trace matches what the same line
  // reports one ply earlier.
  //
  // The probe is a pure TT read (no search), and only warm entries count:
  // `score_moves` reports immediate roads from the board alone, which every
  // position has some of and which prove nothing about who is winning.
  async findOriginAnchor(startPly, size) {
    const tps = startPly.tpsBefore;
    const stmIsP1 = Number(String(tps).split(" ")[1]) === 1;
    const prev = startPly.prevPly;
    let stmScores;
    try {
      stmScores = await scorePosition(tps, size, stmIsP1, SCOPE_TAK_CHAIN);
    } catch (e) {
      return startPly;
    }
    if (countWarmWins(stmScores) > 0) {
      return startPly;
    }
    if (!prev || !prev.tpsBefore) {
      return startPly;
    }
    let opponentScores;
    try {
      opponentScores = await scorePosition(
        tps,
        size,
        !stmIsP1,
        SCOPE_TAK_CHAIN
      );
    } catch (e) {
      return startPly;
    }
    // No warm evidence either way — the TT can't say who is attacking, so
    // walk from here and let the search itself decide, as it did before.
    return countWarmWins(opponentScores) > 0 ? prev : startPly;
  }

  // Everything derived from the solver's proofs, dropped together: the JS
  // result cache, the worker's TT, and the origin spans traced out of them.
  // An origin outliving the proof it came from is the same staleness the
  // scope-keyed cache exists to prevent.
  async clearCaches() {
    this.setState({ tinueOrigins: {}, tinueOrigin: null, tinueVerdict: null });
    await clearAllCaches();
  }

  // Whether this search may continue into quiet (full) scope once strict
  // is done. Interactive only.
  //
  // The counterintuitive part, and the reason this isn't a user setting:
  // under a budget, searching *every* move finds FEWER tinues than
  // searching only tak threats. Over 120 6x6 positions at depth 9 with a
  // 500k cap, strict resolved 100% and proved 17 tinues at a 47ms median;
  // full resolved 24%, aborted on 91, and proved 14 — losing three that
  // strict had proved in under 2k nodes. Widening the move set widens the
  // tree faster than it finds the win.
  //
  // So quiet search is only worth running where there is no budget to
  // spend against it, which is exactly interactive mode's contract: keep
  // working until the user navigates away.
  canExtendToQuiet() {
    return (
      this.state.isInteractiveEnabled &&
      !this.state.isAnalyzingGame &&
      !this.state.isAnalyzingBranch
    );
  }

  // The wasm solve is synchronous in the worker — we don't get mid-search
  // progress, so reporting nps: 0 while running is misleading. Null it out
  // at search start; storeResults still computes the real nps from time +
  // nodes once the search completes.
  onSearchStart(state = {}) {
    super.onSearchStart({ ...state, nps: null, tinueVerdict: null });
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
    // Display mate distance in *moves*, not plies — matches the W/L/R
    // convention used by other TEI engines (and by chess puzzle culture
    // generally). `result.plies` is always odd for a tinue (attacker plays
    // the last move), so (plies + 1) / 2 is exact. The `depth` field
    // stays in plies to match how search depth is reported elsewhere.
    const moves = (result.plies + 1) >> 1;
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
        scoreText: `R${moves}`,
      };
    });
    return { tps, suggestions };
  }

  // Convert a per-move score_moves table into the `{tps, suggestions}`
  // bundle shape that `storeResults` expects. Each suggestion's eval is
  // pinned to the attacker's color (so the eval bar fills toward the
  // winning side regardless of stm), and the score label uses the
  // absolute-winner-coloured `R<moves>` convention rather than the
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

    // Only `Win` is a "this move wins for the attacker" verdict.
    //
    // `Loss { plies: 1 }` means the move played from *this* position creates
    // an opponent road and no mover road — i.e. a suicide for the player to
    // move. Per score_moves's Rust logic, Loss is emitted only when stm ==
    // attacker; the defender-side analogue (defender suicides into the
    // attacker's road) is emitted as `Win` from the attacker's perspective.
    // So Loss entries never represent winning moves for the attacker and
    // must not be rendered as suggestions in this bundle.
    //
    // NoWin/Flat/Unknown are also dropped — none of them establish a
    // forced-road win for the attacker.
    //
    // `plies` counts from *before* the move, so `Win { plies: 1 }` is a road
    // that exists the moment the move is played. Whose blunder that is
    // depends on who is to move:
    //
    //   attacker to move — the attacker completed their own road. A genuine
    //     winning move, and the fastest one possible.
    //   defender to move — the defender handed the road over, which
    //     score_moves reports as a Win because it scores from the attacker's
    //     side. That is a suicide, not a defense.
    //
    // score_moves derives those from the board alone, never touching the TT,
    // so they turn up in *every* position where the defender has a losing
    // spread available — including positions with no tinue at all. That is
    // why `isWarmWin` refuses to count them as evidence the TT is warm here.
    const defenderToMove =
      (Number(String(tps).split(" ")[1]) === 1) !== !!attackerP1;
    const winning = scores.filter(
      (s) => s.kind === "win" && !(defenderToMove && (s.plies || 0) <= 1)
    );
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
      // Display in moves (see comment in buildResultBundle). `s.plies` is
      // odd when the attacker is to move and even when the defender is
      // (their move is the extra ply), so rounding up converts either to
      // whole attacker moves.
      scoreText: `R${(s.plies + 1) >> 1}`,
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
    // score_moves reads verdicts out of the TT namespace belonging to the
    // scope it is given, so this must probe the scope that populated the
    // TT. Sweeps and one-shot analyses both run strict, so there is only
    // one namespace worth asking; the quiet extension writes its own, but
    // only runs where strict came back empty, so it holds no winners.
    let scoreP1, scoreP2;
    try {
      [scoreP1, scoreP2] = await Promise.all([
        scorePosition(tps, size, true, SCOPE_TAK_CHAIN),
        scorePosition(tps, size, false, SCOPE_TAK_CHAIN),
      ]);
    } catch (e) {
      return null;
    }
    const hitsP1 = countWarmWins(scoreP1);
    const hitsP2 = countWarmWins(scoreP2);
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

    // Bounded even in interactive mode, so the strict phase terminates and
    // hands off. Letting it run unbounded would starve the quiet extension
    // on exactly the positions that need it: a dense 6x6 can spend 9
    // minutes on depth 13 alone.
    //
    // Nothing is lost by capping it, because the quiet phase searches
    // every legal move at unbounded depth and so subsumes a deeper strict
    // search.
    const maxPlies = Number(this.settings.depth) || 9;
    // Sweep mode (analyze branch / game) uses the persistent-TT sweep
    // path: each position's search is short, so streaming overhead
    // wouldn't buy anything. Single-position analyses (manual or
    // interactive) stream per-depth via solve_at_depth so the user sees
    // shallow results first and watches the engine deepen.
    const isSweep = !!(
      this.state.isAnalyzingGame || this.state.isAnalyzingBranch
    );

    // Every search starts strict. Quiet scope is only ever reached as a
    // continuation of a strict search that came back empty — see
    // canExtendToQuiet.
    const scope = SCOPE_TAK_CHAIN;
    // Bounds a single position so one runaway can't stall a whole sweep,
    // and so the strict phase always terminates and hands off. The quiet
    // extension is the only unbounded search, and it is cancelled by
    // navigating away rather than by a budget.
    const maxNodes = Number(this.settings.nodes) || 0;

    const request = {
      kind: isSweep ? "sweep" : "stream",
      tps,
      size,
      max_plies: maxPlies,
      max_nodes: maxNodes,
      scope,
    };
    this.onSend(request);

    const t0 = performance.now();

    // Per-depth completion. Updates visible engine state so the toolbar
    // ticks (time/nodes/nps) and the user sees the engine deepening even
    // when intermediate depths return no_tinue. Pushes a provisional
    // result if a tinue was found at this depth; subsequent deeper
    // iterations may refine the multipv winners list as
    // `collect_root_winners` finds more.
    //
    // Takes the phase's scope so a streamed no_tinue can be labelled
    // honestly: under strict scope it means "no strict tinue", which is
    // the weaker claim.
    const onDepth = (phaseScope) => (partial) => {
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
        scope: phaseScope,
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
    };

    let result;
    let resultScope = scope;
    try {
      if (isSweep) {
        result = await sweepPosition(tps, size, { maxPlies, maxNodes, scope });
      } else {
        result = await streamSearchPosition(
          tps,
          size,
          { maxPlies, maxNodes, scope },
          onDepth(scope)
        );

        // Only after a *completed* strict search that found nothing. A
        // strict tinue is already the whole answer: across 46 corpus
        // positions where both scopes proved one, full scope never
        // returned a shorter mate. And an aborted strict search means
        // quiet has no hope on that position either.
        if (
          result &&
          !result.tinue &&
          !result.aborted &&
          this.canExtendToQuiet()
        ) {
          const quietRequest = {
            kind: "stream",
            tps,
            size,
            max_plies: 99,
            max_nodes: 0,
            scope: SCOPE_FULL,
          };
          this.onSend(quietRequest);
          const quiet = await streamSearchPosition(
            tps,
            size,
            { maxPlies: 99, maxNodes: 0, scope: SCOPE_FULL },
            onDepth(SCOPE_FULL)
          );
          if (quiet) {
            result = quiet;
            resultScope = SCOPE_FULL;
          }
        }
      }
    } catch (error) {
      // Cancellation propagates as "tinue-solver: cancelled" — suppress the
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
      // The scope that produced this verdict. A `no_tinue` under strict
      // scope only rules out tak-chain tinues, so the UI must not render
      // it as a bare "no tinue".
      scope: resultScope,
      ...(result.tinue
        ? { tinue: true, plies: result.plies, nodes: result.nodes }
        : {
            tinue: false,
            aborted: !!result.aborted,
            searchedPlies: result.depthSearched,
            nodes: result.nodes,
          }),
    });

    // Record the verdict so a "none found" outcome is visible. Carries the
    // scope, because strict-empty and quiet-empty are different claims.
    if (!isSweep) {
      this.setState({
        tinueVerdict: {
          tps,
          tinue: !!result.tinue,
          scope: resultScope,
          aborted: !!result.aborted,
          searchedPlies: result.depthSearched || null,
        },
      });
    }

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
      await cancelAllSolver();
      this.onTerminate(state);
    } catch (error) {
      this.onError(error);
    }
  }
}
