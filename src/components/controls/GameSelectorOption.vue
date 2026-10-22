<template>
  <q-item
    class="game-selector-option non-selectable"
    v-bind="$attrs"
    v-on="$listeners"
  >
    <q-item-section side>
      <GameThumbnail
        v-if="option.editingTPS"
        :tps="option.editingTPS"
        :config="option.config"
        class="rounded-borders"
      />
      <GameThumbnail
        v-else-if="option.state.tps"
        :tps="option.state.tps"
        :hl="option.state.ply"
        :plyIsDone="option.state.plyIsDone"
        :config="option.config"
        class="rounded-borders"
      />
      <div v-else style="width: 60px; height: 60px" />
    </q-item-section>
    <q-item-section side v-if="showIcon && icon">
      <q-icon
        :name="icon"
        :color="iconColor"
        :style="isPlaytakOption && !isPlaytakConnected ? 'opacity: 0.4' : ''"
      >
        <q-badge v-if="option.config.unseen" floating />
      </q-icon>
    </q-item-section>
    <q-item-section class="fg-inherit">
      <q-item-label style="word-wrap: break-word">{{
        option.label
      }}</q-item-label>
      <template v-if="option.tags">
        <q-item-label v-if="option.tags.player1" class="fg-inherit">
          <q-icon :name="isRandomPlayer ? 'random' : 'player1'" class="q-mr-xs">
            <hint>{{ $t(isRandomPlayer ? "Random" : "Player1") }}</hint>
          </q-icon>
          {{ option.tags.player1 }}
        </q-item-label>
        <q-item-label v-if="option.tags.player2" class="fg-inherit">
          <q-icon :name="isRandomPlayer ? 'random' : 'player2'" class="q-mr-xs">
            <hint>{{ $t(isRandomPlayer ? "Random" : "Player2") }}</hint>
          </q-icon>
          {{ option.tags.player2 }}
        </q-item-label>
      </template>
      <q-item-label v-if="datetime" class="q-pt-xs fg-inherit">
        <relative-time :value="datetime" class="fg-inherit" />
      </q-item-label>
    </q-item-section>
    <q-item-section class="fg-inherit" side>
      <div class="row justify-end q-gutter-xs fg-inherit">
        <GameRules class="q-mr-xs" :komi="komi" :opening="opening" inline />
        <span class="text-bold">
          {{ option.config.size || option.tags.size }}x{{
            option.config.size || option.tags.size
          }}
        </span>
      </div>
      <div v-if="uiOptions.length" class="row justify-end q-gutter-xs q-mt-xs">
        <q-icon v-for="o in uiOptions" :key="o.key" :name="o.icon">
          <hint>{{ $t(o.label) }}</hint>
        </q-icon>
      </div>
      <Result
        v-if="option.tags && option.tags.result"
        :result="option.tags.result"
      />
    </q-item-section>
    <q-item-section v-if="showClose" class="fg-inherit" side>
      <q-btn @click.stop="close" icon="close" flat dense />
    </q-item-section>
  </q-item>
</template>

<style lang="scss">
.game-selector-option .game-thumbnail {
  border: 1px solid;
  border-color: var(--q-color-bg);
}
</style>

<script>
import GameThumbnail from "./GameThumbnail";
import GameRules from "./GameRules";
import Result from "../PTN/Result";

import { uiOptions } from "../../dialogs/GameInfo";
import {
  getPlaytakConnectionState,
  getPlaytakStatusColor,
  normalizePlaytakResult,
} from "../../store/game/playtak";

export default {
  name: "GameSelectorOption",
  components: { GameRules, GameThumbnail, Result },
  props: {
    option: Object,
    showIcon: Boolean,
    showClose: Boolean,
  },
  data() {
    return {
      playtakConnectionState: getPlaytakConnectionState(),
    };
  },
  computed: {
    playtakID() {
      const game = this.option;
      const config = game && game.config;
      return String(
        (config && config.playtakID) || (game && game.playtakID) || ""
      ).trim();
    },
    playtakResult() {
      const game = this.option;
      return normalizePlaytakResult(game && game.playtakResult);
    },
    playtakFinished() {
      const game = this.option;
      return !!(game && game.playtakFinished);
    },
    isPlaytakOption() {
      return !!this.playtakID && !this.playtakFinished;
    },
    isPlaytakConnected() {
      return (
        this.playtakConnectionState.follow ||
        this.playtakConnectionState.ongoing
      );
    },
    icon() {
      let game = this.option;
      if (this.isPlaytakOption) {
        return "playtak";
      }
      if (game.config.isOnline) {
        return this.$store.getters["ui/playerIcon"](
          game.config.player,
          game.config.isPrivate
        );
      } else {
        return null;
      }
    },
    komi() {
      return (
        (this.option.tags && this.option.tags.komi) ||
        (this.option.config && this.option.config.komi)
      );
    },
    opening() {
      return (
        (this.option.tags && this.option.tags.opening) ||
        (this.option.config && this.option.config.opening)
      );
    },
    isRandomPlayer() {
      return (
        this.option.config.isOnline &&
        this.option.config.isOpen &&
        this.option.config.playerSeat === "random"
      );
    },
    datetime() {
      return (
        (this.option.tags && this.option.tags.date) ||
        this.option.updatedAt ||
        this.option.createdAt
      );
    },
    uiOptions() {
      return this.option.config
        ? uiOptions.filter((o) => this.option.config[o.key])
        : [];
    },
    iconColor() {
      if (this.isPlaytakOption) {
        return getPlaytakStatusColor({
          playtakID: this.playtakID,
          playtakResult: this.playtakResult,
          finished: this.playtakFinished,
          connected: this.isPlaytakConnected,
        });
      }
      return this.option.value === 0 ? "primary" : null;
    },
    isLastGame() {
      return this.$store.state.game.list.length === 1;
    },
  },
  methods: {
    close() {
      if (this.showClose) {
        this.$emit("close", this.option.value);
      }
    },
  },
};
</script>
