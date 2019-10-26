<template>
  <q-dialog
    :value="value"
    @input="$emit('input', $event)"
    no-backdrop-dismiss
    no-route-dismiss
  >
    <q-card style="width: 500px" class="bg-secondary" dark>
      <q-card-section style="max-height: 60vh;" class="scroll">
        <GameInfo ref="gameInfo" :game="game" :showAll="showAll" @save="save" />
      </q-card-section>
      <q-separator dark />
      <q-card-actions align="right">
        <q-btn
          :label="$t(showAll ? 'Show Less' : 'Show More')"
          @click="showAll = !showAll"
          flat
        />
        <q-btn :label="$t('OK')" @click="$refs.gameInfo.save()" flat />
        <q-btn :label="$t('Cancel')" flat v-close-popup />
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
