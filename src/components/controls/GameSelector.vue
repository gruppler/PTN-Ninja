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
            <q-list class="bg-secondary text-white">
              <q-item
                clickable
                @click="dialogCloseGames = true"
                :disable="games.length < 2"
              >
                <q-item-section side>
                  <q-icon name="close_multiple" />
                </q-item-section>
                <q-item-section>{{ $t("Close") }}...</q-item-section>
              </q-item>
              <q-item clickable @click="dialogDownloadGames = true">
                <q-item-section side>
                  <q-icon name="download" />
                </q-item-section>
                <q-item-section>{{ $t("Download") }}...</q-item-section>
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
          <q-item-section side>
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

    <CloseGames v-model="dialogCloseGames" />
    <DownloadGames v-model="dialogDownloadGames" />
  </div>
</template>

<script>
import CloseGames from "../dialogs/CloseGames";
import DownloadGames from "../dialogs/DownloadGames";

import { zipObject } from "lodash";

const HISTORY_DIALOGS = {
  dialogCloseGames: "close",
  dialogDownloadGames: "download",
};

export default {
  name: "GameSelector",
  components: { CloseGames, DownloadGames },
  props: ["game"],
  computed: {
    ...zipObject(
      Object.keys(HISTORY_DIALOGS),
      Object.values(HISTORY_DIALOGS).map((key) => ({
        get() {
          return this.$route.name === key;
        },
        set(value) {
          if (value) {
            if (this.$route.name !== key) {
              this.$router.push({ name: key });
            }
          } else {
            if (this.$route.name === key) {
              this.$router.go(-1);
              this.$router.replace({ name: "local" });
            }
          }
        },
      }))
    ),

    games() {
      return this.$store.state.games.map((game, index) => ({
        label: game.name,
        value: index,
        config: game.config,
      }));
    },
    hasOnlineGames() {
      return this.games.some((game) => game.config.id);
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
      return this.games.filter((game) => game.config.unseen).length;
    },
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
        this.$store.dispatch("SELECT_GAME", { index });
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
      this.$store.dispatch("REMOVE_GAME", index);
    },
  },
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
