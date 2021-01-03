<template>
  <small-dialog :value="true" v-bind="$attrs">
    <template v-slot:header>
      <dialog-header icon="close_multiple">{{ $t("Close") }}...</dialog-header>
    </template>

    <q-card style="width: 400px; overflow-x: hidden">
      <q-card-section>
        <q-range
          v-model="range"
          :min="0"
          :max="max"
          :step="1"
          :left-label-value="games[range.min]"
          :right-label-value="games[range.max]"
          style="max-height: calc(100vh - 196px)"
          label-text-color="textDark"
          label-always
          vertical
          markers
          snap
        />
      </q-card-section>
    </q-card>

    <template v-slot:footer>
      <q-card-actions align="right">
        <q-btn :label="$t('Cancel')" color="primary" flat v-close-popup />
        <q-btn :label="$t('OK')" @click="submit" color="primary" flat />
      </q-card-actions>
    </template>
  </small-dialog>
</template>

<script>
export default {
  name: "CloseGames",
  data() {
    return {
      range: {
        min: 1,
        max: this.$store.state.game.list.length - 1,
      },
      min: 0,
    };
  },
  computed: {
    games() {
      return this.$store.state.game.list.map((game) => game.name);
    },
    max() {
      return this.games.length - 1;
    },
  },
  methods: {
    close() {
      this.$router.back();
    },
    submit() {
      this.$store.dispatch("game/REMOVE_MULTIPLE_GAMES", {
        start: this.range.min,
        count: this.range.max - this.range.min + 1,
      });
      this.close();
    },
  },
};
</script>
