<template>
  <div class="full-width justify-center">
    <div class="row no-wrap justify-around items-center">
      <q-btn round flat :disable="!isLast" icon="undo" />
      <q-btn @click="first" round flat :disable="isFirst" icon="first_page" />
      <q-btn
        @click="prev"
        round
        flat
        :disable="isFirst"
        icon="keyboard_arrow_left"
      />
      <q-btn
        @click="isPlaying = !isPlaying"
        round
        color="accent"
        :icon="isPlaying ? 'pause' : 'play_arrow'"
      />
      <q-btn
        @click="next"
        round
        flat
        :disable="isLast"
        icon="keyboard_arrow_right"
      />
      <q-btn @click="last" round flat :disable="isLast" icon="last_page" />
      <q-btn
        round
        flat
        :disable="!game.state.targetBranch && !hasBranches"
        :color="hasBranches ? 'accent' : ''"
        icon="call_split"
      >
        <BranchMenu
          @input="selectBranch"
          v-if="hasBranches"
          :game="game"
          :branches="game.state.ply.branches"
        />
        <BranchMenu
          @input="selectBranch"
          v-if="!hasBranches && game.state.targetBranch"
          :game="game"
          :branches="game.branches[game.state.targetBranch].branches"
        />
      </q-btn>
    </div>
  </div>
</template>

<script>
import BranchMenu from "./BranchMenu";

export default {
  name: "PlayControls",
  components: { BranchMenu },
  props: ["game"],
  data() {
    return {
      isPlaying: false
    };
  },
  computed: {
    isFirst() {
      return !this.game.state.prevPly && !this.game.state.plyIsDone;
    },
    isLast() {
      return !this.game.state.nextPly && this.game.state.plyIsDone;
    },
    hasBranches() {
      return this.game.state.ply && !!this.game.state.ply.branches.length;
    }
  },
  methods: {
    first() {
      if (!this.isFirst) {
        this.game.first();
        this.$store.dispatch("SET_STATE", this.game.state);
      }
    },
    prev() {
      if (!this.isFirst) {
        this.game.prev();
        this.$store.dispatch("SET_STATE", this.game.state);
      }
    },
    next() {
      if (!this.isLast) {
        this.game.next();
        this.$store.dispatch("SET_STATE", this.game.state);
      }
    },
    last() {
      if (!this.isLast) {
        this.game.last();
        this.$store.dispatch("SET_STATE", this.game.state);
      }
    },
    selectBranch(ply) {
      this.game.setTarget(ply);
      this.$store.dispatch("SET_STATE", this.game.state);
    }
  }
};
</script>

<style lang="stylus" scoped>
.q-btn.disabled {
  opacity: 0.3 !important;
}

.row
  max-width 500px
  margin 0 auto
</style>
