<template>
  <q-dialog :value="value" @input="$emit('input', $event)" no-backdrop-dismiss>
    <q-card style="width: 500px" class="bg-secondary">
      <DialogHeader>{{ $t("Edit Game") }}</DialogHeader>

      <q-separator />

      <SmoothReflow>
        <Recess>
          <q-card-section
            style="max-height: calc(100vh - 18rem)"
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

      <q-separator />

      <q-card-actions class="row items-center justify-end q-gutter-sm">
        <MoreToggle v-model="showAll" />
        <q-btn :label="$t('Reset')" @click="reset" flat />
        <div class="col-grow" />
        <q-btn :label="$t('Cancel')" color="accent" flat v-close-popup />
        <q-btn
          :label="$t('OK')"
          @click="$refs.gameInfo.save()"
          :disabled="$refs.gameInfo && $refs.gameInfo.hasError"
          color="accent"
          flat
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import DialogHeader from "../general/DialogHeader.vue";

import GameInfo from "../controls/GameInfo";
import MoreToggle from "../controls/MoreToggle.vue";

export default {
  name: "EditGame",
  components: { GameInfo, DialogHeader, MoreToggle },
  props: ["value", "game"],
  data() {
    return {
      showAll: false
    };
  },
  methods: {
    reset() {
      this.$store.getters.confirm({
        title: this.$t("Confirm"),
        message: this.$t("confirm.resetForm"),
        ok: this.$t("OK"),
        cancel: this.$t("Cancel"),
        success: () => {
          this.$refs.gameInfo.init();
        }
      });
    },
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
