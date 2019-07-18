<template>
  <div class="game-selector no-wrap">
    <q-select
      v-show="!!games.length"
      class="text-subtitle1 no-wrap"
      :value="0"
      :options="games"
      @input="select"
      :display-value="game.label"
      popup-content-class="bg-secondary"
      color="accent"
      options-dark
      emit-value
      filled
      dense
      dark
    >
      <template v-slot:option="scope">
        <q-item
          class="non-selectable"
          v-bind="scope.itemProps"
          v-on="scope.itemEvents"
        >
          <q-item-section>
            <q-item-label>{{ scope.opt.label }}</q-item-label>
          </q-item-section>
          <q-item-section v-if="games.length > 1" side>
            <q-btn
              @click.stop="close(scope.opt.value)"
              icon="close"
              flat
              dense
              round
            />
          </q-item-section>
        </q-item>
      </template>

      <template v-slot:before>
        <q-badge
          class="text-subtitle2"
          transparent
          :label="games.length"
          :alert="true ? 'accent' : false"
        />
      </template>

      <template v-slot:after>
        <q-btn icon="edit" @click.stop="edit" flat dense />
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
        value: index
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
    close(index) {
      this.$store.dispatch("REMOVE_GAME", index);
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
