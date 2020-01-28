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
      :display-value="name"
      :hide-dropdown-icon="$q.screen.lt.sm"
      behavior="menu"
      popup-content-class="bg-secondary"
      color="accent"
      emit-value
      filled
      dense
    >
      <template v-slot:prepend>
        <q-btn
          :label="games.length"
          @click.stop
          @click.right.prevent="select(1)"
          class="text-subtitle2 text-white q-pa-sm"
          dense
          flat
        >
          <q-menu auto-close square>
            <q-list class="bg-secondary text-white">
              <q-item clickable @click="closeAll">
                <q-item-section side>
                  <q-icon name="close" />
                </q-item-section>
                <q-item-section>{{ $t("Close All") }}</q-item-section>
              </q-item>
              <q-item clickable @click="downloadAll">
                <q-item-section side>
                  <q-icon name="download" />
                </q-item-section>
                <q-item-section>{{ $t("Download All") }}</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
        <q-separator vertical class="q-mr-sm" />
      </template>

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
            />
          </q-item-section>
        </q-item>
      </template>

      <template v-slot:append>
        <div class="row">
          <slot />
        </div>
      </template>
    </q-select>
  </div>
</template>

<script>
import { Notify } from "quasar";

export default {
  name: "GameSelector",
  props: ["game"],
  computed: {
    games() {
      return this.$store.state.games.map((game, index) => ({
        label: game.name,
        value: index
      }));
    },
    name() {
      if (!this.game.config.isOnline || this.$q.screen.gt.sm) {
        return this.game.name;
      } else {
        const user = this.$store.state.online.user;
        let otherPlayer = user ? getOtherPlayer(this.game, user.uid) : false;
        if (!otherPlayer) {
          return this.game.name;
        } else {
          otherPlayer = this.game.tag("player" + otherPlayer);
          if (otherPlayer) {
            return this.game.name.replace(
              /[^"]+ vs [^"]+( \dx\d)/,
              "vs " + otherPlayer + "$1"
            );
          } else {
            return this.game.name;
          }
        }
      }
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
      const game = this.$store.state.games[index];
      this.$store.dispatch("REMOVE_GAME", index);
      Notify.create({
        message: this.$t("Game x closed", { game: game.name }),
        timeout: 0,
        color: "secondary",
        position: "bottom",
        actions: [
          {
            label: this.$t("Dismiss"),
            color: "accent"
          },
          {
            label: this.$t("Undo"),
            color: "accent",
            handler: () => {
              this.$store.dispatch("ADD_GAME", game);
            }
          }
        ]
      });
    },
    closeAll() {
      this.$store.getters.confirm({
        title: this.$t("Confirm"),
        message: this.$t("confirm.closeAllGames"),
        success: () => {
          for (let i = this.games.length - 1; i; i--) {
            this.$store.dispatch("REMOVE_GAME", i);
          }
        }
      });
    },
    downloadAll() {
      this.$store.getters.confirm({
        title: this.$t("Confirm"),
        message: this.$t("confirm.downloadAllGames"),
        success: () => {
          const games = this.$store.state.games;
          for (let i = 0; i < games.length; i++) {
            this.$store.dispatch("SAVE", games[i]);
          }
        }
      });
    }
  }
};
</script>

<style lang="stylus">
.game-selector
  max-width 30em
  margin 0 auto
  .q-field--filled .q-field__control
    padding-left 0
    @media (max-width: $breakpoint-xs-max)
      padding-right 0

  .q-field__native span
    text-overflow ellipsis
    white-space nowrap
    overflow hidden
    @media (max-width: $breakpoint-xs-max)
      font-size .85em

    + .no-outline
      position absolute
</style>
