<template>
  <large-dialog
    :value="value"
    @input="$emit('input', $event)"
    no-backdrop-dismiss
    :min-height="showAll ? 750 : 495"
    v-bind="$attrs"
  >
    <template v-slot:header>
      <dialog-header>{{ $t("Edit Game") }}</dialog-header>
    </template>

    <q-card-section class="scroll">
      <GameInfo
        ref="gameInfo"
        :game="game"
        :show-all="showAll"
        @submit="save"
      />
    </q-card-section>

    <template v-slot:footer>
      <q-separator />
      <q-card-actions align="right">
        <MoreToggle v-model="showAll" />
        <q-btn :label="$t('Reset')" @click="reset" flat />
        <div class="col-grow" />
        <q-btn :label="$t('Cancel')" color="accent" flat v-close-popup />
        <q-btn
          :label="$t('OK')"
          @click="$refs.gameInfo.submit()"
          :disabled="$refs.gameInfo && $refs.gameInfo.hasError"
          color="accent"
          flat
        />
      </q-card-actions>
    </template>
  </large-dialog>
</template>

<script>
import GameInfo from "../controls/GameInfo";
import MoreToggle from "../controls/MoreToggle.vue";

export default {
  name: "EditGame",
  components: { GameInfo, MoreToggle },
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
