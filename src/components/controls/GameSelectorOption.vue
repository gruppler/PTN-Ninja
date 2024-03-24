<template>
  <q-item
    class="game-selector-option non-selectable"
    v-bind="$attrs"
    v-on="$listeners"
  >
    <q-item-section side>
      <GameThumbnail
        v-if="option.state.tps"
        :tps="option.state.tps"
        :hl="option.state.ply"
        :plyIsDone="option.state.plyIsDone"
        :config="option.config"
        class="rounded-borders"
      />
      <div v-else style="width: 60px; height: 60px" />
    </q-item-section>
    <q-item-section side v-if="showIcon" class="fg-inherit">
      <q-icon :name="icon" class="fg-inherit">
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
      <q-item-label class="fg-inherit">
        <span v-if="option.tags && option.tags.komi" class="q-mr-xs">
          <q-icon name="komi" />
          {{ option.tags.komi }}
        </span>
        {{ option.config.size || option.tags.size }}x{{
          option.config.size || option.tags.size
        }}
      </q-item-label>
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
  border-color: $bg;
  border-color: var(--q-color-bg);
}
</style>

<script>
import GameThumbnail from "./GameThumbnail";
import Result from "../PTN/Result";

import { uiOptions } from "../../dialogs/GameInfo";

export default {
  name: "GameSelectorOption",
  components: { GameThumbnail, Result },
  props: {
    option: Object,
    showIcon: Boolean,
    showClose: Boolean,
  },
  computed: {
    icon() {
      let game = this.option;
      if (game.config.isOnline) {
        return this.$store.getters["ui/playerIcon"](
          game.config.player,
          game.config.isPrivate
        );
      } else {
        return "file";
      }
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
