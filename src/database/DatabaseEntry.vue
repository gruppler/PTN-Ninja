<template>
  <q-linear-progress
    size="32px"
    :value="progress"
    color="progress-color"
    dark="true"
    rounded
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
    ptn: String,
    total_games: Number,
    white_wins: Number,
    black_wins: Number,
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
.text-progress-color {
  color: $player1special;
  background: $player2special;
}
.database-move-badge {
  font-size: 18px;
  height: 20px;
  font-weight: bold;
}
</style>
