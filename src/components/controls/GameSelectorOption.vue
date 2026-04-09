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
    <q-item-section>
      <q-item-label style="word-wrap: break-word">{{
        option.label
      }}</q-item-label>
    </q-item-section>
    <q-item-section class="fg-inherit" side>
      <q-item-label class="fg-inherit">
        {{ option.config.size }}x{{ option.config.size }}
      </q-item-label>
    </q-item-section>
    <q-item-section v-if="!isLastGame" class="fg-inherit" side>
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
import {
  getPlaytakConnectionState,
  getPlaytakStatusColor,
  normalizePlaytakResult,
} from "../../store/game/playtak";

export default {
  name: "GameSelectorOption",
  components: { GameThumbnail },
  props: {
    option: Object,
    showIcon: Boolean,
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
      return !!this.playtakID;
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
      this.$emit("close", this.option.value);
    },
  },
};
</script>
