<template>
  <q-dialog
    :value="value"
    @input="$emit('input', $event)"
    no-backdrop-dismiss
    no-route-dismiss
  >
    <q-card style="width: 500px" class="bg-secondary" dark>
      <q-card-section
        style="max-height: calc(100vh - 18rem); min-height: 12rem"
        class="scroll"
      >
        <GameInfo
          ref="gameInfo"
          :game="game"
          :show-all="showAll"
          @save="save"
        />
      </q-card-section>
      <q-separator dark />
      <q-card-actions align="right">
        <q-btn
          :label="$t(showAll ? 'Show Less' : 'Show More')"
          @click="showAll = !showAll"
          flat
        />
        <q-btn :label="$t('Cancel')" color="accent" flat v-close-popup />
        <q-btn
          :label="$t('OK')"
          @click="$refs.gameInfo.save()"
          color="accent"
          flat
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import GameInfo from "./GameInfo";

export default {
  name: "EditGame",
  components: { GameInfo },
  props: ["value", "game"],
  data() {
    return {
      showAll: false
    };
  },
  methods: {
    close() {
      this.$emit("input", false);
    },
    save({ name, tags }) {
      this.game.name = name;

      let changedTags = {};
      Object.keys(tags).forEach(key => {
        const value = tags[key];
        if (value !== this.game.tag(key)) {
          changedTags[key] = value;
        }
      });
      if (Object.keys(changedTags).length) {
        this.game.setTags(changedTags);
      }

      this.showAll = false;
      this.close();
    }
  }
};
</script>

<style></style>
