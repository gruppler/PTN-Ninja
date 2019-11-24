<template>
  <span class="ptn ply" v-if="ply">
    <q-chip
      @click.left="select(ply)"
      @click.right.prevent.native="select(ply, true)"
      :class="{ selected: isSelected }"
      :color="ply.color === 1 ? 'blue-grey-2' : 'blue-grey-10'"
      :text-color="ply.color === 1 ? 'blue-grey-10' : 'blue-grey-2'"
      :outline="!isDone"
      :clickable="!noClick"
      :key="ply.id"
      square
      dense
    >
      <span class="ply" :class="'color' + ply.color">
        <span class="pieceCount" v-if="ply.minPieceCount">{{
          ply.minPieceCount
        }}</span>
        <span class="specialPiece" v-if="ply.specialPiece">{{
          ply.specialPiece
        }}</span>
        <span class="square">{{ ply.column + ply.row }}</span>
        <span class="direction" v-if="ply.direction">{{ ply.direction }}</span>
        <span class="distribution" v-if="ply.minDistribution">{{
          ply.minDistribution
        }}</span>
        <span class="wallSmash" v-if="ply.wallSmash">{{ ply.wallSmash }}</span>
        <span class="evaluation" v-if="ply.evaluation">{{
          ply.evaluation.text
        }}</span>
      </span>
      <q-btn
        v-if="!noBranches && ply.branches.length"
        @click.stop
        icon="arrow_drop_down"
        size="md"
        flat
        dense
      >
        <BranchMenu
          @select="selectBranch"
          v-if="ply.branches.length"
          :game="game"
          :branches="ply.branches"
          v-model="menu"
        />
      </q-btn>
    </q-chip>
    <Result :result="ply.result" />
  </span>
</template>

<script>
import BranchMenu from "./BranchMenu";
import Result from "./Result";

export default {
  name: "Ply",
  components: { BranchMenu, Result },
  props: {
    game: Object,
    plyID: Number,
    noBranches: Boolean,
    noClick: Boolean
  },
  data() {
    return {
      menu: false
    };
  },
  computed: {
    ply() {
      return this.game.plies[this.plyID];
    },
    isSelected() {
      return this.game ? this.game.state.plyID === this.ply.id : false;
    },
    isDone() {
      return this.game && this.ply
        ? this.game.state.plyID === this.ply.id
          ? this.game.state.plyIsDone
          : this.game.state.plyIDs.includes(this.ply.id) &&
            this.game.state.ply.index > this.ply.index
        : true;
    }
  },
  methods: {
    select(ply, invert) {
      if (this.noClick) {
        return;
      }
      let isDone = this.game.state.plyIsDone;
      if (invert || ply.id === this.game.state.ply.id) {
        isDone = !isDone;
      }
      this.game.goToPly(ply.id, isDone);
    },
    selectBranch(ply) {
      this.game.setTarget(ply);
    }
  }
};
</script>

<style lang="stylus">
.ptn.ply
  display inline-flex
  vertical-align middle
  flex-direction row
  align-items center

.q-chip
  font-size inherit
  &:not(.q-chip--outline)
    border 1px solid
    &.bg-blue-grey-10
      border-color $blue-grey-10
    &.bg-blue-grey-2
      border-color $blue-grey-2
  &.selected
    box-shadow 0 0 0 2px $accent
    body.desktop &.q-chip--clickable:focus
      box-shadow $shadow-1, 0 0 0 2px $accent
  .q-btn
    margin-right -0.7em

.ply
  font-family 'Source Code Pro'
  font-weight bold

  &.color1
    .pieceCount
      color $blue-dark
    .specialPiece
      color $orange-dark
    .direction
      color $blue-dark
    .distribution
      color $green-dark
    .wallSmash
      color $orange-dark
    .evaluation
      color $orange-dark

  &.color2
    .pieceCount
      color $blue-light
    .specialPiece
      color $orange-light
    .direction
      color $blue-light
    .distribution
      color $green-light
    .wallSmash
      color $orange-light
    .evaluation
      color $orange-light

  .q-chip--outline &
    &.color1, &.color2
      .pieceCount
        color $blue-med
      .specialPiece
        color $orange-med
      .direction
        color $blue-med
      .distribution
        color $green-med
      .wallSmash
        color $orange-med
      .evaluation
        color $orange-med
</style>
