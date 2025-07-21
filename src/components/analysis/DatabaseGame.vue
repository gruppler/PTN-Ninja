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
      <q-item-label>
        <span class="q-px-md" />
        <relative-time :value="date" />
      </q-item-label>
    </q-item-section>
    <q-item-section side>
      <Result :result="result" />
      <div class="q-mt-xs q-gutter-x-sm">
        <q-icon v-if="tournament" name="event">
          <hint>{{ $t("analysis.tournamentGame") }}</hint>
        </q-icon>
        <span>
          <q-icon name="komi" class="q-mr-xs" />
          {{ komiString }}
          <hint>{{ $t("Komi") }} {{ komiString }}</hint>
        </span>
      </div>
    </q-item-section>
    <q-inner-loading :showing="loading" />
  </q-item>
</template>

<script>
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
    date: Date,
    komi: Number,
    tournament: Boolean,
  },
  data() {
    return {
      loading: false,
    };
  },
  computed: {
    komiString() {
      return (this.komi || 0).toString().replace(/0?\.5/, "½");
    },
  },
  methods: {
    loadGame() {
      this.loading = true;
      this.$store
        .dispatch("game/ADD_PLAYTAK_GAME", {
          id: this.playtakId,
          state: {
            plyIndex: this.$store.state.game.position.plyIndex,
            plyIsDone: this.$store.state.game.position.plyIsDone,
          },
        })
        .catch()
        .finally(() => {
          this.loading = false;
        });
    },
  },
};
</script>
