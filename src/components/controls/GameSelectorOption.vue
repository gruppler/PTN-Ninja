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
    <q-item-section side v-if="showIcon">
      <q-icon :name="icon" :class="{ 'text-primary': option.value === 0 }">
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
  border-color: $bg;
  border-color: var(--q-color-bg);
}
</style>

<script>
import GameThumbnail from "./GameThumbnail";

export default {
  name: "GameSelectorOption",
  components: { GameThumbnail },
  props: {
    option: Object,
    showIcon: Boolean,
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
