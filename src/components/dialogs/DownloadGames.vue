<template>
  <small-dialog :value="value" @input="$emit('input', $event)" v-bind="$attrs">
    <template v-slot:header>
      <dialog-header icon="download">{{ $t("Download") }}...</dialog-header>
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
  props: ["value"],
  data() {
    return {
      range: {
        min: 0,
        max: this.$store.state.games.length - 1,
      },
      min: 0,
    };
  },
  computed: {
    games() {
      return this.$store.state.games.map((game) => game.name);
    },
    max() {
      return this.games.length - 1;
    },
  },
  methods: {
    close() {
      this.$emit("input", false);
    },
    submit() {
      const count = this.range.max - this.range.min + 1;
      this.$store.dispatch("PROMPT", {
        title: this.$t("Confirm"),
        message: this.$tc("confirm.downloadMultipleGames", count),
        success: () => {
          this.$store.dispatch(
            "SAVE_PTN",
            this.$store.state.games.slice(this.range.min, this.range.max + 1)
          );
          this.close();
        },
      });
    },
  },
  watch: {
    value(show) {
      if (show) {
        this.range.min = 0;
        this.range.max = this.max;
      }
    },
  },
};
</script>
