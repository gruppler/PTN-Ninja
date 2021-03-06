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
      :unselected="currentOnly"
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
    ply1() {
      return !this.standalone && this.$store.state.showAllBranches
        ? this.move.ply1
        : this.move.ply1Original || this.move.ply1;
    },
    ply2() {
      return this.move.ply2
        ? this.$store.state.showAllBranches && !this.currentOnly
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
        (this.$store.state.showAllBranches
          ? this.game.state.move.id === this.move.id
          : this.game.state.move.index === this.move.index)
      );
    },
    linebreak() {
      return (
        this.$store.state.showAllBranches &&
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
        this.$store.state.showAllBranches &&
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
  }
}
</style>
