<template>
  <q-item class="non-selectable" v-bind="$attrs" v-on="$listeners">
    <q-item-section side>
      <GameThumbnail :game="option" />
    </q-item-section>
    <q-item-section side v-if="showIcon" class="fg-inherit">
      <q-icon :name="icon" class="fg-inherit">
        <q-badge v-if="option.config.unseen" floating />
      </q-icon>
    </q-item-section>
    <q-item-section>
      <q-item-label style="word-wrap: break-word">{{
        option.label
      }}</q-item-label>
      <template v-if="option.tags">
        <q-item-label v-if="option.tags.player1">
          <q-icon :name="isRandomPlayer ? 'random' : 'player1'" left />
          {{ option.tags.player1 }}
        </q-item-label>
        <q-item-label v-if="option.tags.player2">
          <q-icon :name="isRandomPlayer ? 'random' : 'player2'" left />
          {{ option.tags.player2 }}
        </q-item-label>
      </template>
      <q-item-label v-if="datetime" class="q-pt-xs">
        <relative-time :value="datetime" />
      </q-item-label>
    </q-item-section>
    <q-item-section side>
      <q-item-label>
        {{ option.config.size || option.tags.size }}x{{
          option.config.size || option.tags.size
        }}
      </q-item-label>
      <Result
        v-if="option.tags && option.tags.result"
        :result="option.tags.result"
      />
    </q-item-section>
    <q-item-section v-if="canClose" side>
      <q-btn @click.stop="close" icon="close" flat dense />
    </q-item-section>
  </q-item>
</template>

<script>
import GameThumbnail from "./GameThumbnail";
import Result from "../PTN/Result";

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
    canClose() {
      return this.showClose && this.$store.state.game.list.length > 1;
    },
  },
  methods: {
    close() {
      if (this.canClose) {
        this.$store.dispatch("game/REMOVE_GAME", this.option.value);
      }
    },
  },
};
</script>
