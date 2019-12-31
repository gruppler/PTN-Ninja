<template>
  <div class="game-selector no-wrap">
    <q-select
      ref="select"
      v-if="games.length"
      class="text-subtitle1 no-wrap"
      :value="0"
      :options="games"
      @input="select"
      @keydown.esc="$refs.select.blur"
      @keydown.delete="close($refs.select.optionIndex)"
      :display-value="game.label"
      behavior="menu"
      popup-content-class="bg-secondary"
      color="accent"
      emit-value
      filled
      dense
    >
      <template v-slot:prepend>
        <q-icon
          v-if="game.game.isOnline"
          :name="gameIcon(game.game)"
          size="md"
        />
      </template>

      <template v-slot:option="scope">
        <q-item
          class="non-selectable"
          v-bind="scope.itemProps"
          v-on="scope.itemEvents"
        >
          <q-item-section side v-if="scope.opt.game.isOnline">
            <q-icon
              :name="gameIcon(scope.opt.game)"
              :class="{ 'text-accent': scope.opt.value === 0 }"
            />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ scope.opt.label }}</q-item-label>
          </q-item-section>
          <q-item-section v-if="games.length > 1" side>
            <q-btn
              @click.stop="close(scope.opt.value)"
              icon="close"
              flat
              dense
            />
          </q-item-section>
        </q-item>
      </template>

      <template v-slot:before>
        <q-badge class="text-subtitle2" :label="games.length" />
      </template>

      <template v-slot:after>
        <slot />
      </template>
    </q-select>
  </div>
</template>

<script>
export default {
  name: "GameSelector",
  computed: {
    game() {
      return this.games[0];
    },
    games() {
      return this.$store.state.games.map((game, index) => ({
        label: game.name,
        value: index,
        game: game.config
      }));
    }
  },
  methods: {
    select(index) {
      if (index >= 0 && this.games.length > index) {
        this.$store.dispatch("SELECT_GAME", index);
        this.$emit("input", this.$store.state.games[0]);
      }
    },
    gameIcon(game) {
      return this.$store.getters["online/gameIcon"](game.player);
    },
    close(index) {
      const game = this.$store.state.games[index];
      this.$store.getters.confirm({
        title: this.$t("confirm.closeGame", { game: game.name }),
        ok: this.$t("OK"),
        cancel: this.$t("Cancel"),
        success: () => {
          if (game.config.id && !game.config.playerKey) {
            this.$store.dispatch("online/REMOVE_ONLINE_GAME", game);
          }
          this.$store.dispatch("REMOVE_GAME", index);
        }
      });
    },
    edit() {
      this.$emit("edit");
    }
  }
};
</script>

<style lang="stylus">
.game-selector
  max-width 30em
  margin 0 auto
  .q-field__native span
    text-overflow ellipsis
    white-space nowrap
    overflow hidden
</style>
