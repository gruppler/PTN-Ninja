<template>
  <div
    class="move"
    :class="{
      linebreak: linebreakRow,
      separator: separatorRowClass,
      'current-only': currentOnly,
      standalone: standalone,
    }"
    :style="rowStyle"
  >
    <div
      v-if="showEvalRow && $store.state.ui.showEval && evaluationsForRow.length"
      class="evaluations column"
    >
      <div
        v-for="(evaluation, i) in evaluationsForRow"
        class="evaluation col"
        :class="{ p1: evaluation > 0, p2: evaluation < 0 }"
        :style="{ width: Math.abs(evaluation) + '%' }"
        :key="i"
      />
    </div>

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
      <template v-if="!noDecoration && !currentOnly">
        <div class="depth-indicator" v-for="i in depth" :key="i" />
      </template>
      <Linenum
        v-if="move.linenum"
        :linenum="move.linenum"
        :no-branch="noBranch || separateBranch"
        :style="{
          paddingLeft: (fixedLinenumberWidth ? 1.5 : 0) + 'em',
          width: fixedLinenumberWidth ? '3em' : 'auto',
        }"
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

    <q-separator v-if="separatorRow" class="fullwidth-padded-md" />
  </div>
</template>

<script>
import Linenum from "./Linenum";
import Ply from "./Ply";

export default {
  name: "Move",
  components: { Linenum, Ply },
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
      let eval1 = this.ply1
        ? this.$store.state.game.comments.evaluations[this.ply1.id]
        : null;
      let eval2 = this.ply2
        ? this.$store.state.game.comments.evaluations[this.ply2.id]
        : null;
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
        return this.evaluations;
      }
      if (this.splitPly === "split1") {
        const eval1 = this.ply1
          ? this.$store.state.game.comments.evaluations[this.ply1.id]
          : null;
        return eval1 != null ? [eval1] : [];
      }
      if (this.splitPly === "split2") {
        const eval2 = this.ply2
          ? this.$store.state.game.comments.evaluations[this.ply2.id]
          : null;
        return eval2 != null ? [eval2] : [];
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
    rowStyle() {
      if (this.currentOnly || this.noDecoration) {
        return null;
      }
      const depth = this.depth + (this.isCurrentMove ? 3 : 0);
      return depth
        ? {
            background: `rgba(${
              this.$store.state.ui.theme.panelDark ? "255,255,255" : "0,0,0"
            },${depth * 2 * 0.0333})`,
          }
        : null;
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
};
</script>

<style lang="scss">
.move {
  position: relative;

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
    width: 3em;
  }

  .nop {
    font-family: "Source Code Pro";
    padding: 4px 8px;
    color: var(--q-color-player1);
    white-space: nowrap;
    display: inline-block;
    vertical-align: middle;
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
    min-height: 35px;
    position: relative;

    .depth-indicator {
      display: inline-block;
      position: relative;
      vertical-align: middle;
      opacity: 0.5;
      width: 2em;
      margin-right: -1.5em;
      height: 2.55em;
      border-width: 0 2px 0 0;
      border-style: solid;
      border-color: var(--q-color-text-light);
      body.panel-dark & {
        border-color: var(--q-color-text-dark);
      }
    }
  }
}
</style>
