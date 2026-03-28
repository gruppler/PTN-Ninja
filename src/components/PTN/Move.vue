<template>
  <div
    class="move"
    :class="{
      'current-move': isCurrentMove,
      linebreak: linebreakRow,
      separator: separatorRowClass,
      'current-only': currentOnly,
      standalone: standalone,
    }"
  >
    <Linenum
      v-if="showSeparateBranchRow"
      :linenum="move.linenum"
      :unselected="currentOnly"
      only-branch
      :no-menu-btn="noMenuBtn"
      :full-width="branchBar"
      class="relative-position"
      :class="{
        'q-ml-sm': !branchBar && !currentOnly && fixedLinenumberWidth,
      }"
    />
    <div class="move-wrapper">
      <div
        v-if="
          showEvalRow && $store.state.ui.showEval && evaluationsForRow.length
        "
        class="evaluations column"
      >
        <div
          v-for="(bar, i) in evaluationsForRow"
          class="evaluation col"
          :class="{ empty: !bar }"
          :key="`eval-bar-${i}`"
        >
          <WdlBar v-if="bar" :wdl="bar" />
        </div>
      </div>

      <template v-if="!noDecoration && !currentOnly">
        <div
          class="depth-indicator"
          v-for="i in depth"
          :key="`depth-indicator-${i}`"
        />
      </template>
      <Linenum
        v-if="move.linenum"
        :linenum="move.linenum"
        :no-branch="noBranch || separateBranch"
        :center-number="alignLinenumToEvalMidpoint"
        :class="{ 'align-to-eval-midpoint': alignLinenumToEvalMidpoint }"
        :style="linenumStyle"
        :no-menu-btn="noMenuBtn"
      />
      <template v-if="!player || player === 1">
        <span v-if="splitPly === 'split2'" class="ptn nop">--</span>
        <span v-else-if="ply1 && ply1.isNop" class="ptn nop">{{
          ply1.text
        }}</span>
        <Ply
          v-else-if="ply1"
          :key="ply1.id"
          :ply="ply1"
          :inline-branches="inlineBranches"
        />
      </template>
      <template v-if="ply2 && !ply2.isNop && (!player || player === 2)">
        <span v-if="splitPly === 'split1'" class="ptn nop">--</span>
        <Ply
          v-else
          :key="ply2.id"
          :ply="ply2"
          :inline-branches="inlineBranches"
        />
      </template>
    </div>

    <q-separator
      v-if="separatorRow"
      class="fullwidth-padded-md"
      :dark="$store.state.ui.theme.panelDark"
    />
  </div>
</template>

<script>
import Linenum from "./Linenum";
import Ply from "./Ply";
import WdlBar from "../WdlBar";
import { normalizeWDL } from "../../bots/wdl";

export default {
  name: "Move",
  components: { Linenum, Ply, WdlBar },
  props: {
    move: Object,
    player: Number,
    depth: Number,
    currentOnly: Boolean,
    standalone: Boolean,
    noDecoration: Boolean,
    noMenuBtn: Boolean,
    branchBar: Boolean,
    inlineBranches: Boolean,
    separateBranch: Boolean,
    fixedLinenumberWidth: Boolean,
    noBranch: Boolean,
    showEval: Boolean,
    splitPly: String,
  },
  computed: {
    showAllBranches() {
      return this.$store.state.ui.showAllBranches;
    },
    position() {
      return this.$store.state.game.position;
    },
    ptn() {
      return this.$store.state.game.ptn;
    },
    ply1() {
      return !this.standalone && this.showAllBranches
        ? this.move.ply1
        : this.move.ply1Original || this.move.ply1;
    },
    ply2() {
      return this.move.ply2
        ? this.showAllBranches && !this.currentOnly
          ? this.move.ply2
          : this.ptn.branchPlies[this.move.ply2.index]
        : null;
    },
    evaluations() {
      let evaluations = [];
      let eval1 = this.getEvalBar(this.ply1);
      let eval2 = this.getEvalBar(this.ply2);
      if (eval1 != null) {
        evaluations.push(eval1);
      }
      if (eval2 != null) {
        evaluations.push(eval2);
      }
      return evaluations;
    },
    evaluationsForRow() {
      if (!this.splitPly) {
        // For non-split moves: keep one slot per displayed ply.
        // This preserves blank top/bottom halves when one side has no data.
        const eval1 = this.getEvalBar(this.ply1);
        const eval2 = this.getEvalBar(this.ply2);
        const hasPly1 = this.ply1 && !this.ply1.isNop;
        const hasPly2 = this.ply2 && !this.ply2.isNop;

        if (hasPly1 && hasPly2) {
          if (eval1 == null && eval2 == null) {
            return [];
          }
          return [eval1, eval2];
        }
        if (hasPly1 && eval1 != null) {
          return [eval1, null];
        }
        if (hasPly2 && eval2 != null) {
          return [null, eval2];
        }
        return [];
      }
      if (this.splitPly === "split1") {
        const eval1 = this.getEvalBar(this.ply1);
        return eval1 != null ? [eval1, null] : [];
      }
      if (this.splitPly === "split2") {
        const eval2 = this.getEvalBar(this.ply2);
        return eval2 != null ? [null, eval2] : [];
      }
      return [];
    },
    index() {
      return this.ptn.sortedMoves.findIndex((move) => move === this.move);
    },
    prevMove() {
      const moves = this.ptn.sortedMoves;
      return this.index > 0 ? moves[this.index - 1] : null;
    },
    nextMove() {
      const moves = this.ptn.sortedMoves;
      return this.index < moves.length - 1 ? moves[this.index + 1] : null;
    },
    isCurrentMove() {
      return (
        !this.noDecoration &&
        !this.currentOnly &&
        this.position.move &&
        (this.showAllBranches
          ? this.position.move.id === this.move.id
          : this.position.move.index === this.move.index)
      );
    },
    linebreak() {
      if (this.branchBar) {
        return false;
      }
      return (
        this.showAllBranches &&
        !this.noDecoration &&
        !this.currentOnly &&
        this.nextMove &&
        this.nextMove.branch != this.move.branch
      );
    },
    linebreakRow() {
      return this.linebreak && (!this.splitPly || this.splitPly === "split2");
    },
    separator() {
      return (
        this.linebreak &&
        this.separateBranch &&
        (!this.move.branch ||
          // Next move's branch originates from root
          !this.ptn.allPlies[this.nextMove.firstPly.branches[0]].branch)
      );
    },
    showEvalRow() {
      return this.showEval;
    },
    showSeparateBranchRow() {
      return (
        this.showSeparateBranch &&
        (!this.splitPly || this.splitPly === "split1")
      );
    },
    separatorRow() {
      return this.separator && (!this.splitPly || this.splitPly === "split2");
    },
    separatorRowClass() {
      return this.separatorRow;
    },
    alignLinenumToEvalMidpoint() {
      return (
        this.fixedLinenumberWidth &&
        this.showEvalRow &&
        this.$store.state.ui.showEval
      );
    },
    linenumStyle() {
      if (!this.fixedLinenumberWidth) {
        return { paddingLeft: "0em", width: "auto" };
      }
      if (this.alignLinenumToEvalMidpoint) {
        return { paddingLeft: "0.3em", width: "4rem" };
      }
      return { paddingLeft: "1.5em", width: "3em" };
    },
    showSeparateBranch() {
      return !!(
        !this.noBranch &&
        this.move.branch &&
        (this.showAllBranches || this.currentOnly) &&
        this.separateBranch &&
        (this.standalone ||
          this.player ||
          (this.prevMove && this.prevMove.branch != this.move.branch))
      );
    },
  },
  methods: {
    getEvalBar(ply) {
      if (!ply) return null;
      const tps = ply.tpsAfter;
      const context = { preferredPlyID: ply.id };
      const evaluation = this.$store.getters["game/evaluationForTps"](
        tps,
        context
      );
      const getWdlForTps = this.$store.getters["game/wdlForTps"];
      const wdl = getWdlForTps ? getWdlForTps(tps, context) : null;
      return normalizeWDL(wdl, evaluation);
    },
  },
};
</script>

<style lang="scss">
.move {
  &.current-move {
    background-color: $dim;
    body.panelDark & {
      background-color: $highlight;
    }
  }

  &.linebreak {
    margin-bottom: 0.5em;
    + .move {
      margin-top: 0.5em;
    }
  }

  &.linebreak.separator {
    padding-bottom: 0.5em;
    margin-bottom: 1px;
    + .move {
      padding-top: 0.5em;
      margin-top: 0;
    }
  }

  .evaluations {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: 4rem;

    .evaluation {
      position: relative;
      overflow: hidden;
    }
  }

  .nop {
    font-family: "Source Code Pro";
    padding: 4px 8px;
    white-space: nowrap;
    display: inline-block;
    vertical-align: middle;
    color: var(--q-color-textDark);
    body.panelDark & {
      color: var(--q-color-textLight);
    }
  }

  .linenum.align-to-eval-midpoint {
    justify-content: center !important;

    .number {
      display: block;
      width: 100%;
      text-align: center;
      margin-right: 0;
      font-variant-numeric: tabular-nums;
      transform: translateX(-0.08em);
    }
  }

  .linenum.align-to-eval-midpoint + .ptn.ply .q-chip {
    margin-left: 0;
  }

  .q-separator {
    position: relative;
    bottom: calc(-0.75em - 1px);
  }

  &.standalone {
    display: inline-block;
    border-radius: 5px;
    padding: 0 0.5em;
    background-color: var(--q-color-panel);
  }

  .move-wrapper {
    position: relative;
    min-height: 35px;
    position: relative;

    .depth-indicator {
      display: inline-block;
      position: relative;
      vertical-align: middle;
      opacity: 0.5;
      width: 2rem;
      margin-right: -1.5em;
      height: 2.55em;
      border-width: 0 2px 0 0;
      border-style: solid;
      border-color: var(--q-color-textDark);
      body.panelDark & {
        border-color: var(--q-color-textLight);
      }
    }
  }
}
</style>
