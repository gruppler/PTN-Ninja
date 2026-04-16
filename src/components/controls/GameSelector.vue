<template>
  <div class="game-selector no-wrap">
    <q-select
      ref="select"
      v-if="games.length"
      class="text-subtitle1 no-wrap"
      :value="0"
      :options="showSearch ? filteredGames : games"
      :use-input="showSearch"
      :input-debounce="150"
      @blur="showSearch = false"
      @filter="search"
      @input="select"
      @keydown.esc="$refs.select.blur"
      @keydown.delete="showSearch ? null : close($refs.select.optionIndex)"
      :hide-dropdown-icon="$q.screen.lt.sm"
      behavior="menu"
      popup-content-class="game-selector-options"
      transition-show="none"
      transition-hide="none"
      :virtual-scroll-item-size="84"
      emit-value
      filled
      dense
    >
      <template v-slot:selected>
        <span>{{ showSearch ? "" : name }}</span>
      </template>

      <template v-slot:prepend>
        <q-btn
          :label="games.length"
          @click.stop.prevent
          class="text-subtitle2 q-pa-sm"
          dense
          flat
        >
          <hint>{{ $t("Manage Games") }}</hint>
          <q-menu
            transition-show="none"
            transition-hide="none"
            auto-close
            square
          >
            <q-list>
              <q-item
                clickable
                @click="$router.push({ name: 'close' })"
                :disable="games.length < 2"
              >
                <q-item-section side>
                  <q-icon name="close_multiple" />
                </q-item-section>
                <q-item-section>{{ $t("Close") }}...</q-item-section>
              </q-item>
              <q-item clickable @click="$router.push({ name: 'download' })">
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
          v-if="showStatusIcon"
          :icon="icon"
          :color="statusIconColor"
          :style="
            isPlaytakSelected && !isPlaytakConnected ? 'opacity: 0.4' : ''
          "
          @click.stop.prevent="statusIconClick"
          :loading="isPlaytakConnecting"
          dense
          flat
        />
      </template>

      <template v-slot:option="scope">
        <GameSelectorOption
          :key="scope.opt.label"
          :option="scope.opt"
          :show-icon="hasOnlineGames"
          @close="close"
          v-bind="scope.itemProps"
          v-on="scope.itemEvents"
        />
      </template>

      <template v-slot:append>
        <div class="row q-gutter-sm">
          <q-badge
            v-if="unseenCount"
            text-color="ui"
            :label="unseenCount"
            class="q-mr-sm"
          />
          <q-icon
            name="search"
            @click.stop="toggleSearch()"
            class="q-field__focusable-action q-mr-sm"
            :color="showSearch ? 'primary' : ''"
          >
            <hint>{{ $t("Search") }}</hint>
          </q-icon>
          <slot />
        </div>
      </template>
    </q-select>
  </div>
</template>

<script>
import GameSelectorOption from "./GameSelectorOption";
import {
  getPlaytakConnectionState,
  getPlaytakIDFromGame,
  isPlaytakGameMainlineEnded,
  getPlaytakResultFromGame,
  getPlaytakStatusColor,
} from "../../store/game/playtak";

import Fuse from "fuse.js";
const fuseOptions = {
  keys: ["name"],
  threshold: 0.25,
  ignoreLocation: true,
};

export default {
  name: "GameSelector",
  components: { GameSelectorOption },
  data() {
    return {
      showSearch: false,
      dirtyIndex: false,
      filteredGames: null,
      query: "",
      index: null,
      playtakConnectionState: getPlaytakConnectionState(),
      isPlaytakConnecting: false,
    };
  },
  computed: {
    config() {
      return this.$store.state.game.config;
    },
    games() {
      return this.$store.state.game.list.map((game, index) => {
        const playtakID = getPlaytakIDFromGame(game);
        return {
          label: game.name,
          value: index,
          config: game.config,
          state: game.state,
          editingTPS: game.editingTPS,
          playtakID,
          playtakResult: playtakID ? getPlaytakResultFromGame(game) : "",
          playtakFinished: playtakID ? isPlaytakGameMainlineEnded(game) : false,
        };
      });
    },
    gameList() {
      return this.$store.state.game.list.map((g) => g.name);
    },
    hasOnlineGames() {
      return this.games.some((game) => {
        const config = game && game.config;
        return !!((config && config.id) || (game && game.playtakID));
      });
    },
    selectedPlaytakID() {
      const game = this.$store.state.game;
      return game ? getPlaytakIDFromGame(game) : "";
    },
    selectedPlaytakResult() {
      const game = this.$store.state.game;
      if (!game || !this.selectedPlaytakID) {
        return "";
      }
      return getPlaytakResultFromGame(game);
    },
    selectedPlaytakFinished() {
      const game = this.$store.state.game;
      if (!game || !this.selectedPlaytakID) {
        return false;
      }
      return isPlaytakGameMainlineEnded(game);
    },
    isPlaytakSelected() {
      return !!this.selectedPlaytakID && !this.selectedPlaytakFinished;
    },
    isPlaytakConnected() {
      return (
        this.playtakConnectionState.follow ||
        this.playtakConnectionState.ongoing
      );
    },
    showStatusIcon() {
      return this.config.isOnline || this.isPlaytakSelected;
    },
    icon() {
      if (this.isPlaytakSelected) {
        return "playtak";
      }
      if (this.config.isOnline) {
        return this.$store.getters["ui/playerIcon"](
          this.config.player,
          this.config.isPrivate
        );
      } else {
        return "file";
      }
    },
    statusIconColor() {
      if (this.isPlaytakSelected) {
        return getPlaytakStatusColor({
          playtakID: this.selectedPlaytakID,
          playtakResult: this.selectedPlaytakResult,
          finished: this.selectedPlaytakFinished,
          connected: this.isPlaytakConnected,
        });
      }
      return null;
    },
    name() {
      const name = this.games[0].label;
      if (!this.config.isOnline || this.$q.screen.gt.sm) {
        return name;
      } else {
        let player = this.config.player;
        let otherPlayer = player ? (player === 1 ? 2 : 1) : 0;
        if (!otherPlayer) {
          return name;
        } else {
          otherPlayer = this.$store.state.game.ptn.tags["player" + otherPlayer];
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
      return this.games.filter((game) => game.config?.unseen).length;
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
    statusIconClick() {
      if (this.isPlaytakSelected && !this.isPlaytakConnected) {
        this.isPlaytakConnecting = true;
        const game = this.$game;
        this.$store
          .dispatch("game/FOLLOW_PLAYTAK_GAME", {
            id: this.selectedPlaytakID,
            state: game ? game.minState : null,
          })
          .catch((error) => this.notifyError(error, { position: "top-left" }))
          .finally(() => (this.isPlaytakConnecting = false));
      } else if (this.config.isOnline) {
        this.account(); // TODO: Decide what should actually happen here
      }
    },
    select(index) {
      this.showSearch = false;
      this.$store.dispatch("game/SELECT_GAME", { index });
      this.$emit("input", this.$store.state.game.list[0]);
    },
    close(index) {
      let filteredIndex = -1;
      if (this.showSearch && this.index) {
        filteredIndex = this.filteredGames.findIndex(
          (game) => game.label === this.gameList[index]
        );
        this.filteredGames.forEach((option) => {
          if (option.value > index) {
            option.value -= 1;
          }
        });
        if (filteredIndex >= 0) {
          this.filteredGames.splice(filteredIndex, 1);
          this.$refs.select.refresh(filteredIndex);
          this.$refs.select.setOptionIndex(filteredIndex);
        }
      }
      this.$store.dispatch("game/REMOVE_GAME", index);
    },
    toggleSearch(focusInput = false) {
      this.showSearch = !this.showSearch;
      if (this.showSearch) {
        this.$refs.select.inputValue = this.query;
        if (focusInput) {
          this.$nextTick(() => {
            this.$refs.select.focus();
            this.$refs.select.showPopup();
          });
        }
      }
    },
    search(query, update) {
      this.query = query;
      update(
        () => this.updateFiltered(),
        (ref) => {
          if (query.trim() !== "" && ref.options.length > 0) {
            this.$nextTick(() => {
              ref.refresh(-1);
              ref.setOptionIndex(-1);
            });
          }
        }
      );
    },
    updateIndex() {
      if (!this.index) {
        this.index = new Fuse(this.gameList, fuseOptions);
      } else {
        this.index.setCollection(this.gameList);
      }
      this.dirtyIndex = false;
    },
    updateFiltered() {
      this.filteredGames = this.index
        .search(this.query)
        .map((result) => this.games[result.refIndex]);
    },
  },
  watch: {
    gameList() {
      if (this.showSearch) {
        this.dirtyIndex = true;
      } else {
        this.updateIndex();
        this.updateFiltered();
      }
    },
    showSearch(showSearch) {
      if (!showSearch && this.dirtyIndex) {
        this.updateIndex();
        this.updateFiltered();
      }
      this.$refs.select.refresh(-1);
    },
  },
  mounted() {
    this.updateIndex();
  },
};
</script>

<style lang="scss">
.game-selector {
  width: 100%;
  max-width: 60em;
  min-width: 0;
  margin: 0 auto;
  .q-field--filled .q-field__control {
    padding-left: 0;
    @media (max-width: $breakpoint-xs-max) {
      padding-right: 0;
    }
  }

  .q-field__native {
    span {
      text-overflow: ellipsis;
      white-space: nowrap;
      overflow: hidden;
      @media (max-width: $breakpoint-xs-max) {
        font-size: 0.85em;
      }
    }

    .no-outline {
      position: absolute;
    }
  }
  .q-badge {
    align-self: center;
    padding: 5px;
    font-weight: bold;
  }
}

.game-selector-options {
  .q-badge {
    padding: 4px;
  }
}
</style>
