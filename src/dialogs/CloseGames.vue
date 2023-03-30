<template>
  <small-dialog ref="dialog" :value="true" v-bind="$attrs">
    <template v-slot:header>
      <dialog-header icon="close_multiple">{{ $t("Close") }}...</dialog-header>
    </template>

    <q-card style="width: 400px; max-width: 100%; overflow-x: hidden">
      <q-card-section>
        <q-range
          v-model="range"
          :min="0"
          :max="max"
          :step="1"
          :left-label-value="games[range.min]"
          :right-label-value="games[range.max]"
          style="max-height: calc(100vh - 196px)"
          label-always
          vertical
          markers
          snap
        />
      </q-card-section>
    </q-card>

    <template v-slot:footer>
      <q-card-actions align="right">
        <div class="q-pl-md">
          {{ $tc("n_games", count) }}
        </div>
        <div class="col-grow" />
        <q-btn :label="$t('Cancel')" color="primary" flat v-close-popup />
        <q-btn
          :label="$t('OK')"
          @click="submit"
          :disable="!canSubmit"
          color="primary"
          flat
        />
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
    count() {
      return this.range.max - this.range.min + 1;
    },
    canSubmit() {
      return this.count < this.games.length;
    },
  },
  methods: {
    close() {
      this.$refs.dialog.hide();
    },
    submit() {
      if (!this.canSubmit) {
        return;
      }
      this.$store.dispatch("game/REMOVE_MULTIPLE_GAMES", {
        start: this.range.min,
        count: this.count,
      });
      this.close();
    },
  },
};
</script>
