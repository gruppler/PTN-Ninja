<template>
  <q-dialog :value="value" @input="$emit('input', $event)" seamless>
    <q-card style="width: 400px; overflow: visible" class="bg-secondary">
      <dialog-header icon="close_multiple">
        {{ $t("Close") }}
      </dialog-header>

      <q-card-section>
        <q-range
          v-model="range"
          :min="0"
          :max="max"
          :step="1"
          :left-label-value="games[range.min]"
          :right-label-value="games[range.max]"
          style="max-height: calc(100vh - 196px)"
          color="accent"
          label-text-color="grey-10"
          label-always
          vertical
          markers
          snap
        />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn :label="$t('Cancel')" color="accent" flat v-close-popup />
        <q-btn :label="$t('OK')" @click="submit" color="accent" flat />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
export default {
  name: "CloseGames",
  props: ["value"],
  data() {
    return {
      range: {
        min: 1,
        max: this.$store.state.games.length - 1
      },
      min: 0
    };
  },
  computed: {
    games() {
      return this.$store.state.games.map(game => game.name);
    },
    max() {
      return this.games.length - 1;
    }
  },
  methods: {
    close() {
      this.$emit("input", false);
    },
    submit() {
      this.$store.dispatch("REMOVE_MULTIPLE_GAMES", {
        start: this.range.min,
        count: this.range.max - this.range.min + 1
      });
      this.close();
    }
  },
  watch: {
    value(show) {
      if (show) {
        this.range.min = 1;
        this.range.max = this.max;
      }
    }
  }
};
</script>
