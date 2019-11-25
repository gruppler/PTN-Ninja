<template>
  <q-dialog
    :value="value"
    @input="$emit('input', $event)"
    no-backdrop-dismiss
    no-route-dismiss
  >
    <q-card style="width: 500px" class="bg-secondary" dark>
      <DialogHeader class="text-h6 text-white">{{
        $t("Edit Game")
      }}</DialogHeader>

      <q-separator dark />

      <SmoothReflow>
        <Recess>
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
        </Recess>
      </SmoothReflow>

      <q-separator dark />

      <q-card-actions class="row items-center justify-end q-gutter-sm">
        <MoreToggle v-model="showAll" />
        <div class="col-grow" />
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
import DialogHeader from "./DialogHeader.vue";
import MoreToggle from "./MoreToggle.vue";
import Recess from "./Recess";
import SmoothReflow from "./SmoothReflow";
import GameInfo from "./GameInfo";

export default {
  name: "EditGame",
  components: { DialogHeader, MoreToggle, Recess, SmoothReflow, GameInfo },
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
