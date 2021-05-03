<template>
  <q-linear-progress
    class="database-entry"
    size="32px"
    :value="progress"
    dark
    rounded
    v-on:click="make_move()"
  >
    <div>
      <q-badge
        class="database-move-badge absolute-top-left flex flex-center"
        color="ui"
        text-color="textLight"
        :label="progressLabel1"
        transparent
      />
      <q-badge
        class="database-move-badge absolute-top-right flex flex-center"
        color="ui"
        text-color="textLight"
        :label="progressLabel2"
        transparent
      />
    </div>
  </q-linear-progress>
</template>

<script>
export default {
  name: "DatabaseEntry",

  props: {
    game: Object,
    ptn: String,
    total_games: Number,
    white_wins: Number,
    black_wins: Number,
  },

  methods: {
    make_move() {
      this.game.insertPly(this.ptn);
    },
  },

  computed: {
    progress() {
      return this.white_wins / this.total_games;
    },

    progressLabel1() {
      return this.ptn;
    },

    progressLabel2() {
      return this.total_games + " games";
    },
  },
};
</script>

<style lang="scss">
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
</style>
