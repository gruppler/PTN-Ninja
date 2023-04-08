<template>
  <div
    class="move"
    :class="{
      'current-move': isCurrentMove,
      linebreak,
      separator,
      'current-only': currentOnly,
      standalone: standalone,
    }"
  >
    <div
      v-if="showEval && $store.state.ui.showEval && evaluations.length"
      class="evaluations column"
    >
      <div
        v-for="(evaluation, i) in evaluations"
        class="evaluation col"
        :class="{ p1: evaluation > 0, p2: evaluation < 0 }"
        :style="{ width: Math.abs(evaluation) + '%' }"
        :key="i"
      />
    </div>

    <Linenum
      v-if="showSeparateBranch"
      :linenum="move.linenum"
      :unselected="currentOnly"
      only-branch
    />
    <div class="move-wrapper">
      <Linenum
        v-if="move.linenum"
        :linenum="move.linenum"
        :no-branch="noBranch || separateBranch"
      />
      <template v-if="!player || player === 1">
        <span v-if="ply1 && ply1.isNop" class="ptn nop">{{ ply1.text }}</span>
        <Ply v-else-if="ply1" :key="ply1.id" :ply="ply1" />
      </template>
      <template v-if="ply2 && !ply2.isNop && (!player || player === 2)">
        <Ply :key="ply2.id" :ply="ply2" />
      </template>
    </div>

    <q-separator v-if="separator" class="fullwidth-padded-md" />
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
    currentOnly: Boolean,
    standalone: Boolean,
    noDecoration: Boolean,
    separateBranch: Boolean,
    noBranch: Boolean,
    showEval: Boolean,
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
      if (eval1) {
        evaluations.push(eval1);
      }
      if (eval2) {
        evaluations.push(eval2);
      }
      return evaluations;
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
      return (
        this.showAllBranches &&
        !this.noDecoration &&
        !this.currentOnly &&
        this.nextMove &&
        this.nextMove.branch != this.move.branch
      );
    },
    separator() {
      return (
        this.linebreak &&
        (!this.move.branch ||
          // Next move's branch originates from root
          !this.ptn.allPlies[this.nextMove.firstPly.branches[0]].branch)
      );
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

  &.current-move {
    background-color: $dim;
    body.panelDark & {
      background-color: $highlight;
    }
  }

  &.linebreak {
    margin-bottom: 0.75em;
    + .move {
      margin-top: 0.75em;
    }
  }

  &.linebreak.separator {
    padding-bottom: 0.75em;
    margin-bottom: 1px;
    + .move {
      padding-top: 0.75em;
      margin-top: 0;
    }
  }
  &:first-child {
    padding-top: 0.75em;
  }
  &:last-child {
    padding-bottom: 0.75em;
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
    color: $player1;
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
    .linenum,
    .linenum .branch {
      color: $textDark;
      color: var(--q-color-textDark);
      body.panelDark & {
        color: $textLight !important;
        color: var(--q-color-textLight) !important;
      }
    }
    background-color: $panel;
    background-color: var(--q-color-panel);
  }

  .move-wrapper {
    min-height: 35px;
    position: relative;
  }
}
</style>
