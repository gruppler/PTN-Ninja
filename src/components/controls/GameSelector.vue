<template>
  <div class="game-selector no-wrap">
    <q-select
      ref="select"
      v-if="games.length"
      class="text-subtitle1"
      :value="0"
      :options="games"
      @input="select"
      @keydown.esc="$refs.select.blur"
      @keydown.delete="close($refs.select.optionIndex)"
      :display-value="game.label"
      :hide-dropdown-icon="$q.screen.lt.sm"
      behavior="menu"
      popup-content-class="bg-secondary"
      color="accent"
      emit-value
      filled
      dense
    >
      <template v-slot:prepend>
        <q-icon
          v-if="game.config.isOnline"
          :name="icon(game)"
          :size="$q.screen.lt.sm ? 'xs' : 'sm'"
        />
      </template>

      <template v-slot:option="scope">
        <q-item
          class="non-selectable"
          v-bind="scope.itemProps"
          v-on="scope.itemEvents"
        >
          <q-item-section side v-if="scope.opt.config.isOnline">
            <q-icon
              :name="icon(scope.opt)"
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
        <div class="row">
          <q-separator vertical spaced inset />
          <q-btn
            :label="games.length"
            @click.right.prevent="select(1)"
            class="text-subtitle2 q-pa-sm"
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
                    <q-icon name="save_alt" />
                  </q-item-section>
                  <q-item-section>{{ $t("Download All") }}</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </div>
      </template>

      <template v-slot:after>
        <div class="row">
          <slot />
          <q-separator vertical spaced inset />
        </div>
      </template>
    </q-select>
  </div>
</template>

<script>
import { Notify } from "quasar";
import { getPlayer } from "../../PTN/Game/online";

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
        config: game.config
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
    icon(game) {
      const user = this.$store.state.online.user;
      return this.$store.getters.playerIcon(
        user ? getPlayer(game, user.uid) : 0
      );
    },
    close(index) {
      const game = this.$store.state.games[index];
      this.$store.dispatch("REMOVE_GAME", index);
      Notify.create({
        message: this.$t("Game x closed", { game: game.name }),
        timeout: 5000,
        color: "secondary",
        position: "bottom",
        actions: [
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
  .q-field__native span
    text-overflow ellipsis
    white-space nowrap
    overflow hidden
    @media (max-width: $breakpoint-xs-max)
      font-size .8em

    + .no-outline
      position absolute
</style>
