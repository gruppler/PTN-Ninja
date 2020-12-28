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
    <Linenum
      v-if="showSeparateBranch"
      :linenum="move.linenum"
      :game="game"
      only-branch
    />
    <div class="move-wrapper">
      <Linenum
        v-if="move.linenum"
        :linenum="move.linenum"
        :game="game"
        :no-branch="noBranch || separateBranch"
      />
      <template v-if="ply1 && (!player || player === 1)">
        <span v-if="ply1.isNop" class="ptn nop">{{ ply1.text() }}</span>
        <Ply v-else :key="ply1.id" :plyID="ply1.id" :game="game" />
      </template>
      <template v-if="ply2 && !ply2.isNop && (!player || player === 2)">
        <Ply :key="ply2.id" :plyID="ply2.id" :game="game" />
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
    game: Object,
    player: Number,
    currentOnly: Boolean,
    standalone: Boolean,
    noDecoration: Boolean,
    separateBranch: Boolean,
    noBranch: Boolean,
  },
  computed: {
    showAllBranches() {
      return this.$store.state.ui.showAllBranches;
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
          : this.move.ply2.getBranch(this.game.state.targetBranch)
        : null;
    },
    index() {
      return this.game.movesSorted.findIndex((move) => move === this.move);
    },
    prevMove() {
      const moves = this.game.movesSorted;
      return this.index > 0 ? moves[this.index - 1] : null;
    },
    nextMove() {
      const moves = this.game.movesSorted;
      return this.index < moves.length - 1 ? moves[this.index + 1] : null;
    },
    isCurrentMove() {
      return (
        !this.noDecoration &&
        !this.currentOnly &&
        this.game.state.move &&
        (this.showAllBranches
          ? this.game.state.move.id === this.move.id
          : this.game.state.move.index === this.move.index)
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
        (!this.move.branch || !this.nextMove.firstPly.branches[0].branch)
      );
    },
    showSeparateBranch() {
      return !!(
        !this.noBranch &&
        this.move.branch &&
        this.showAllBranches &&
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
  &.current-move {
    background-color: $dim;
    body.panelDark & {
      background-color: $highlight;
    }
  }

  &.current-only .linenum .branch {
    background-color: transparent;
    color: inherit;
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
    background-color: $panel;
    background-color: var(--q-color-panel);
    transition: opacity $generic-hover-transition;
    opacity: 1;
    &.lt-sm {
      opacity: 0;
    }
  }

  .move-wrapper {
    min-height: 35px;
  }
}
</style>
