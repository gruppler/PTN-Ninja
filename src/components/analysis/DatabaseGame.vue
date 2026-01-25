<template>
  <q-item
    class="database-game q-pr-none q-py-none"
    clickable
    @click="loadGame()"
    :class="[dark ? 'text-textLight' : 'text-textDark']"
    v-bind="$attrs"
  >
    <q-item-section class="q-py-sm">
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
    <q-item-section class="fg-inherit q-mr-md q-py-sm" side>
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
    <q-separator :dark="dark" vertical />
    <q-btn icon="open_in_new" @click.stop="loadGame(true)" stretch flat />
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
    dark: Boolean,
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
    loadGame(inNewTab = false) {
      this.loading = true;
      this.$store
        .dispatch(
          inNewTab ? "game/OPEN_TAKEXPLORER_GAME" : "game/ADD_TAKEXPLORER_GAME",
          {
            id: this.playtakId,
            state: {
              plyIndex: this.$store.state.game.position.plyIndex,
              plyIsDone: this.$store.state.game.position.plyIsDone,
            },
          }
        )
        .catch()
        .finally(() => {
          this.loading = false;
        });
    },
  },
};
</script>

<style lang="scss">
.database-game {
  + .database-game {
    border-top: 1px solid $separator-color;
    body.panelDark & {
      border-top-color: $separator-dark-color;
    }
  }
}
</style>
