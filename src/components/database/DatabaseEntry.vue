<template>
  <div>
    <q-linear-progress
      class="database-entry"
      size="32px"
      :value="progress"
      dark
      rounded
      v-on:click="make_move(ptn)"
    >
      <div>
        <q-badge
          class="database-move-badge absolute-top-left flex flex-center"
          :color="colorClass(ply_id)"
          :text-color="textClass(ply_id)"
          :label="ptnLabel"
          transparent
        />
        <q-badge
          class="database-move-badge absolute-top-right flex flex-center"
          color="ui"
          :text-color="textClass(ply_id)"
          :label="totalLabel"
          transparent
        />
      </div>
    </q-linear-progress>
    <div class="following-moves">
      <q-badge
        v-for="(mv, i) in following_moves"
        :key="i"
        :text-color="textClass(ply_id + i + 1)"
        :color="colorClass(ply_id + i + 1)"
        :label="mv"
        transparent
        v-on:click="make_following_move(i)"
        class="following-move"
      >
        <q-tooltip> Some text as content of Tooltip </q-tooltip>
        <hint> Apply all moves till here </hint>
      </q-badge>
    </div>
  </div>
</template>

<script>
export default {
  name: "DatabaseEntry",

  props: {
    ptn: String,
    total_games: Number,
    white_wins: Number,
    black_wins: Number,
    total_label_suffix: {
      type: String,
      default: "games",
    },
    following_moves: Array,
    ply_id: {
      type: Number,
    },
  },

  methods: {
    make_move(ptn) {
      this.$store.dispatch("game/INSERT_PLY", ptn);
    },
    make_following_move(i) {
      for (const mv of [this.ptn, ...this.following_moves.slice(0, i + 1)]) {
        this.make_move(mv);
      }
    },
    textClass(plyId) {
      return plyId % 2 == 1 ? "player1" : "player2";
      return ["player2", "player1"][plyId % 2];
    },
    colorClass(plyId) {
      return plyId % 2 == 1 ? "bg" : "ui";
    },
  },

  computed: {
    progress() {
      return this.white_wins / this.total_games;
    },

    ptnLabel() {
      return this.ptn;
    },

    totalLabel() {
      return `${this.total_games} ${this.total_label_suffix}`;
    },
  },
};
</script>

<style lang="scss" scoped>
.database-move-badge {
  font-size: 18px;
  height: 20px;
  font-weight: bold;
}
.database-entry {
  color: $player1special;
  background: $player2special;
}
.database-entry:hover {
  color: lightpink;
  background: darkred;
  cursor: pointer;
}
.following-moves {
  // make sure it doesn't get too wide
  display: contents;
  overflow-x: hidden;
  white-space: nowrap;
}
.following-move:hover {
  color: lightpink !important;
  background: darkred !important;
  cursor: pointer;
}
</style>
