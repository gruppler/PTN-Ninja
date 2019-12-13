<template>
  <q-dialog :value="value" @input="$emit('input', $event)" no-backdrop-dismiss>
    <q-card style="width: 500px" class="ptn-editor-dialog bg-secondary">
      <DialogHeader>{{ $t("Edit PTN") }}</DialogHeader>

      <q-separator />

      <Recess>
        <q-card-section style="height: calc(100vh - 18rem)" class="q-pa-none">
          <PTN-editor ref="editor" :game="game" @save="save" />
        </q-card-section>
      </Recess>

      <q-card-actions class="row items-center justify-end q-gutter-sm">
        <div class="col-grow error-message q-px-sm">
          {{ editor ? editor.error : "" }}
        </div>
        <q-btn :label="$t('Cancel')" color="accent" flat v-close-popup />
        <q-btn
          :label="$t('OK')"
          @click="editor.save()"
          color="accent"
          :disabled="editor && !!editor.error"
          flat
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import DialogHeader from "../general/DialogHeader.vue";

import PTNEditor from "../controls/PTNEditor.vue";

export default {
  name: "EditPTN",
  components: { DialogHeader, PTNEditor },
  props: ["value", "game"],
  data() {
    return {
      showAll: false,
      editor: null
    };
  },
  methods: {
    close() {
      this.$emit("input", false);
    },
    save(notation) {
      this.game.updatePTN(notation);
      this.close();
    }
  },
  watch: {
    value(isVisible) {
      if (isVisible) {
        this.$nextTick(() => {
          this.editor = this.$refs.editor;
        });
      }
    }
  }
};
</script>

<style lang="stylus">
.ptn-editor-dialog
  .error-message
    color $negative
    font-weight bold
</style>
