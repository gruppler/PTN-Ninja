<template>
  <div class="piece-selector row no-wrap">
    <div class="col-grow" />
    <q-btn
      @click="select(type, player === 1 ? 2 : 1)"
      :icon="player === 1 ? 'person' : 'person_outline'"
      flat
      round
    />
    <q-btn @click="select('F')" flat round>
      <div class="square" :class="{ selected: type === 'F' }">
        <div class="stone" :class="{ ['p' + player]: true, shadows }" />
      </div>
    </q-btn>
    <q-btn @click="select('S')" flat round>
      <div class="square" :class="{ selected: type === 'S' }">
        <div class="stone S" :class="{ ['p' + player]: true, shadows }" />
      </div>
    </q-btn>
    <q-btn @click="select('C')" flat round>
      <div class="square" :class="{ selected: type === 'C' }">
        <div class="stone C" :class="{ ['p' + player]: true, shadows }" />
      </div>
    </q-btn>
    <div class="col-grow" />
    <slot />
  </div>
</template>

<script>
export default {
  name: "PieceSelector",
  props: ["value", "game", "types"],
  data() {
    return {
      player: this.value.player || 1,
      type: this.value.type || "F"
    };
  },
  computed: {
    available() {
      return [this.types ? this.types : ["F", "S", "C"]].filter(type => {
        type = type === "C" ? "cap" : "flat";
        return (
          this.game.state.pieces[this.player][type].length <
          this.game.pieceCounts[type]
        );
      });
    },
    shadows() {
      return this.$store.state.pieceShadows;
    }
  },
  methods: {
    select(type = this.type, player = this.player) {
      this.player = player;
      this.type = type;
      this.$emit("input", { player: this.player, type: this.type });
    }
  }
};
</script>

<style lang="stylus">
.piece-selector
  .square
    width 2.25em
    height 2.25em
    background $blue-grey-5
    position relative
    border-radius 3px
    &.selected
      background mix($accent, @background, 75%)

    .stone
      position absolute
      bottom 0
      left 0
      width 50%
      height 50%
      margin 25%
      box-sizing border-box
      border 1px solid rgba(#000, .8)
      border-radius 10%

      &.shadows
        border-color transparent !important
        box-shadow $shadow-1

      &.p1
        background-color $blue-grey-2
        border-color $blue-grey-7
      &.p2
        background-color $blue-grey-7
        border-color $blue-grey-10

      &.S
        width 18.75%
        left 15%
        border-radius 27%/10%

        &.p1
          background-color $blue-grey-1
          transform rotate(-45deg)
          &.shadows
            box-shadow -1px 1px 2px rgba(#000, .3)
        &.p2
          background-color $blue-grey-8
          transform rotate(45deg)
          &.shadows
            box-shadow 1px 1px 2px rgba(#000, .3)
      &.C
        border-radius 50%
        &.p1
          background-color $blue-grey-1
        &.p2
          background-color $blue-grey-8
</style>
