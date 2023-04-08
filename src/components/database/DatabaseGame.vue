<template>
  <q-item clickable @click="loadGame">
    <q-item-section>
      <q-item-label>
        <q-icon name="player1" left />
        {{ player1 }} <em>({{ rating1 }})</em>
      </q-item-label>
      <q-item-label>
        <q-icon name="player2" left />
        {{ player2 }} <em>({{ rating2 }})</em>
      </q-item-label>
    </q-item-section>
    <q-item-section side>
      <Result :result="result" />
    </q-item-section>
    <q-inner-loading :showing="loading" />
  </q-item>
</template>

<script>
import Game from "../../Game";
import Result from "../PTN/Result";

export default {
  name: "DatabaseGame",
  components: { Result },
  props: {
    player1: String,
    player2: String,
    rating1: Number,
    rating2: Number,
    playtakId: Number,
    result: String,
  },
  data() {
    return {
      loading: false,
    };
  },
  methods: {
    async loadGame() {
      try {
        this.loading = true;
        let response = await fetch(
          `https://openings.exegames.de/api/v1/game/${this.playtakId}`
        );

        if (response.ok) {
          let data = await response.json();
          let game = new Game({ ptn: data.ptn });
          this.$store.dispatch("game/ADD_GAME", game);
        } else {
          this.notifyError("HTTP-Error: " + response.status);
        }
      } catch (error) {
        this.notifyError(error);
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>
