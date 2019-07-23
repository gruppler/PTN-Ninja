<template>
  <span class="ptn" v-if="ply">
    <span v-if="ply.isNop" class="nop">{{ ply.text() }} </span>
    <q-chip
      v-if="!ply.isNop"
      @click="select(ply)"
      :class="{ selected: isSelected }"
      :color="ply.color == 1 ? 'blue-grey-2' : 'blue-grey-9'"
      :text-color="ply.color == 1 ? 'blue-grey-9' : 'blue-grey-2'"
      :outline="!isDone"
      :clickable="!noClick"
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
        @click.stop="nop"
        icon="arrow_drop_down"
        size="md"
        flat
        dense
      >
        <BranchMenu
          @input="selectBranch"
          v-if="ply.branches.length"
          :game="game"
          :branches="ply.branches"
        />
      </q-btn>
    </q-chip>
    <span class="result" v-if="ply.result">
      <span class="color1" :class="'result-' + ply.result.player1">{{
        ply.result.player1
      }}</span>
      <span class="color2" :class="'result-' + ply.result.player2">{{
        ply.result.player2
      }}</span>
    </span>
  </span>
</template>

<script>
import BranchMenu from "./BranchMenu";

export default {
  name: "Ply",
  components: { BranchMenu },
  props: ["game", "ply", "noBranches", "noClick", "delay"],
  computed: {
    isSelected() {
      return this.game ? this.game.state.plyID === this.ply.id : false;
    },
    isDone() {
      return this.game && this.ply
        ? this.game.state.plyID === this.ply.id
          ? this.game.state.plyIsDone
          : this.ply.isInBranch(this.game.state.targetBranch) &&
            this.game.state.ply.index > this.ply.index
        : true;
    }
  },
  methods: {
    select(ply, isDone) {
      if (this.noClick) {
        return;
      }
      if (isDone === undefined) {
        if (ply.id === this.game.state.ply.id) {
          isDone = !this.game.state.plyIsDone;
        } else if (this.delay) {
          isDone = false;
          setTimeout(() => {
            if (ply.id === this.game.state.ply.id) {
              this.select(ply, true);
            }
          }, this.delay);
        } else {
          isDone = true;
        }
      }
      if (this.game.goToPly(ply.id, isDone)) {
        this.$store.dispatch("SET_STATE", this.game.state);
      }
    },
    selectBranch(ply) {
      this.game.setTarget(ply);
      this.$store.dispatch("SET_STATE", this.game.state);
    },
    nop() {}
  }
};
</script>

<style lang="stylus">
.ptn
  text-indent 0

.nop
  color $gray-light

.q-chip
  * {
    vertical-align baseline !important
  }
  &:not(.q-chip--outline)
    border 1px solid
    &.bg-blue-grey-9
      border-color $blue-grey-9
    &.bg-blue-grey-2
      border-color $blue-grey-2
  &.selected
    box-shadow 0 0 0 2px $accent
    body.desktop &.q-chip--clickable:focus
      box-shadow $shadow-1, 0 0 0 2px $accent
  .q-btn
    margin-right -0.7em

.ply
  font-weight bold

  &.color1
    .pieceCount
      color $green-dark
    .specialPiece
      color $orange-dark
    .direction
      color $green-dark
    .distribution
      color $blue-dark
    .wallSmash
      color $red-dark
    .evaluation
      color $red-dark

  &.color2, .q-chip--outline &.color1
    .pieceCount
      color $green-light
    .specialPiece
      color $orange-light
    .direction
      color $green-light
    .distribution
      color $blue-light
    .wallSmash
      color $red-light
    .evaluation
      color $red-light

.result
  white-space nowrap
  font-weight bold
  height 24px
  margin 4px
  .color1, .color2
    padding 2px 6px
  .color1
    background-color $gray-light
    border-radius 4px 0 0 4px
    &.result-R
      color $green-dark
    &.result-F
      color $blue-dark
    &.result-0
      color $red-dark
    &.result-1\/2
      color $orange-dark
  .color2
    background-color $gray-dark
    border-radius 0 4px 4px 0
    &.result-R
      color $green-light
    &.result-F, &.result-1
      color $blue-light
    &.result-0
      color $red-light
    &.result-1\/2
      color $orange-light
</style>
