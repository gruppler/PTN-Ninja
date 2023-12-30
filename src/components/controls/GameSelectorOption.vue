<template>
  <q-item class="non-selectable" v-bind="$attrs" v-on="$listeners">
    <q-item-section side>
      <GameThumbnail
        :game-id="option.label"
        :tps="option.state.tps"
        :hl="option.state.ply"
        :plyIsDone="option.state.plyIsDone"
        :config="option.config"
        class="rounded-borders"
        no-transition
      />
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
    <q-item-section v-if="!isLastGame" side>
      <q-btn @click.stop="close" icon="close" flat dense />
    </q-item-section>
  </q-item>
</template>

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
