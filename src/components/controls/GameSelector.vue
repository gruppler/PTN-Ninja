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
      :display-value="name"
      :hide-dropdown-icon="$q.screen.lt.sm"
      behavior="menu"
      popup-content-class="game-selector-options"
      color="accent"
      emit-value
      filled
      dense
    >
      <template v-slot:prepend>
        <q-btn
          :label="games.length"
          @click.stop
          class="text-subtitle2 text-white q-pa-sm"
          dense
          flat
        >
          <q-menu auto-close square>
            <q-list v-if="games.length > 2" class="bg-secondary text-white">
              <q-item clickable @click="closeMultiple">
                <q-item-section side>
                  <q-icon name="close" />
                </q-item-section>
                <q-item-section>{{ $t("Close Oldest Games") }}</q-item-section>
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

        <q-btn
          v-if="game.config.isOnline"
          :icon="icon(game)"
          @click.stop="account"
          dense
          flat
        />
      </template>

      <template v-slot:option="scope">
        <q-item
          class="non-selectable"
          v-bind="scope.itemProps"
          v-on="scope.itemEvents"
        >
          <q-item-section side v-if="hasOnlineGames">
            <q-icon
              :name="icon(scope.opt)"
              :class="{ 'text-accent': scope.opt.value === 0 }"
            >
              <q-badge v-if="scope.opt.config.unseen" color="accent" floating />
            </q-icon>
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

      <template v-slot:append>
        <div class="row">
          <q-badge
            v-if="unseenCount"
            color="accent"
            text-color="grey-10"
            :label="unseenCount"
            class="q-mr-sm"
          />
          <slot />
        </div>
      </template>
    </q-select>
  </div>
</template>

<script>
export default {
  name: "GameSelector",
  props: ["game"],
  computed: {
    games() {
      return this.$store.state.games.map((game, index) => ({
        label: game.name,
        value: index,
        config: game.config
      }));
    },
    hasOnlineGames() {
      return this.games.some(game => game.config.id);
    },
    name() {
      const name = this.games[0].label;
      if (!this.game.config.isOnline || this.$q.screen.gt.sm) {
        return name;
      } else {
        let player = this.game.config.player;
        let otherPlayer = player ? (player === 1 ? 2 : 1) : 0;
        if (!otherPlayer) {
          return name;
        } else {
          otherPlayer = this.game.tag("player" + otherPlayer);
          if (otherPlayer) {
            return name.replace(
              /[^"]+ vs [^"]+( \dx\d)/,
              "vs " + otherPlayer + "$1"
            );
          } else {
            return name;
          }
        }
      }
    },
    unseenCount() {
      return this.games.filter(game => game.config.unseen).length;
    }
  },
  methods: {
    account() {
      const user = this.$store.state.online.user;
      const player = this.games[0].config.player;
      if (!player) {
        this.$router.push({ name: "join" });
      } else if (user && !user.isAnonymous) {
        this.$router.push({ name: "account" });
      } else {
        this.$router.push({ name: "login" });
      }
    },
    select(index) {
      if (index >= 0 && this.games.length > index) {
        this.$store.dispatch("SELECT_GAME", index);
        this.$emit("input", this.$store.state.games[0]);
      }
    },
    icon(game) {
      if (game.config.isOnline) {
        return this.$store.getters.playerIcon(
          game.config.player,
          game.config.isPrivate
        );
      } else {
        return "file";
      }
    },
    close(index) {
      if (this.games.length <= 1) {
        return;
      }
      const game = this.$store.state.games[index];
      this.$store.dispatch("REMOVE_GAME", index);
      this.$q.notify({
        message: this.$t("Game x closed", { game: game.name }),
        timeout: 10000,
        progress: true,
        progressClass: "bg-primary",
        color: "secondary",
        position: "bottom",
        multiLine: false,
        actions: [
          {
            label: this.$t("Undo"),
            color: "accent",
            handler: () => {
              this.$store.dispatch("ADD_GAME", game);
            }
          },
          { icon: "close", color: "grey-2" }
        ]
      });
    },
    closeMultiple() {
      const max = this.games.length - 1;
      this.$store.getters.prompt({
        title: this.$t("Close Oldest Games"),
        prompt: {
          model: max,
          type: "number",
          attrs: {
            min: 2,
            max
          }
        },
        success: count => {
          this.$store.getters.prompt({
            title: this.$t("Confirm"),
            message: this.$tc("confirm.closeOldestGames", count),
            success: () => {
              for (let i = 0; i < count; i++) {
                this.$store.dispatch(
                  "REMOVE_GAME",
                  this.games.length - count - 1
                );
              }
            }
          });
        }
      });
    },
    downloadAll() {
      this.$store.getters.prompt({
        title: this.$t("Confirm"),
        message: this.$t("confirm.downloadAllGames"),
        success: () => {
          this.$store.dispatch("SAVE", this.$store.state.games);
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

  .q-field__native
    span
      text-overflow ellipsis
      white-space nowrap
      overflow hidden
      @media (max-width: $breakpoint-xs-max)
        font-size .85em

    .no-outline
      position absolute

  .q-badge
    align-self center
    padding 5px
    font-weight bold

.game-selector-options
  background $secondary
  .q-badge
    padding 4px
</style>
