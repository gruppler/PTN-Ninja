<template>
  <recess>
    <q-scroll-area ref="scroll" class="games-db absolute-fit non-selectable">
      <div class="q-pa-md" v-if="db_moves">
        <DatabaseEntry
          class="q-mt-sm"
          v-for="move in db_moves"
          :key="move.id"
          :ptn="move.ptn"
          :total_games="move.total_games"
          :white_wins="move.white_wins"
          :black_wins="move.black_wins"
        />
      </div>
    </q-scroll-area>
    <q-resize-observer @resize="scroll" />
  </recess>
</template>

<script>
import DatabaseEntry from "../../database/DatabaseEntry";

export default {
  name: "GamesDB",
  components: { DatabaseEntry },
  props: {
    game: Object,
    recess: Boolean,
  },
  computed: {
    db_moves() {
      return [
        { ptn: "c4", total_games: 1098, white_wins: 563, black_wins: 535 },
        { ptn: "b2", total_games: 608, white_wins: 341, black_wins: 267 },
        { ptn: "d3", total_games: 374, white_wins: 127, black_wins: 247 },
      ];
    },
  },
  methods: {
    scroll(animate = false) {},
  },
  watch: {
    game() {
      this.scroll(true);
    },
    "game.state.plyID"() {
      this.scroll(true);
    },
  },
  mounted() {
    this.scroll();
  },
};
</script>

<style lang="scss">
$padding: 16px;
.games-db {
  .content {
    padding-top: calc(100vh - #{$toolbar-min-height + $footer-toolbar-height});
  }
  .q-separator {
    opacity: 0.75;
  }
  .current {
    background-color: $dim;
    body.panelDark & {
      background-color: $highlight;
    }
  }
  .q-message:not(:last-child) {
    margin-bottom: 3px;
    .q-message-text {
      border-radius: $generic-border-radius;
      min-height: 2em;
      &:before {
        display: none;
      }
    }
  }
  .ply-container {
    padding-bottom: 0.5em;
  }
}
</style>
