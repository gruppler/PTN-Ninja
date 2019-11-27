<template>
  <q-dialog :value="value" @input="$emit('input', $event)" no-backdrop-dismiss>
    <q-card style="width: 500px" class="bg-secondary">
      <DialogHeader>{{ $t("Edit PTN") }}</DialogHeader>

      <q-separator />

      <SmoothReflow>
        <Recess>
          <q-card-section style="height: calc(100vh - 18rem)" class="q-pa-none">
            <PTN-editor ref="editor" :game="game" @save="save" />
          </q-card-section>
        </Recess>
      </SmoothReflow>

      <q-card-actions class="row items-center justify-end q-gutter-sm">
        <q-btn :label="$t('Cancel')" color="accent" flat v-close-popup />
        <q-btn
          :label="$t('OK')"
          @click="$refs.editor.save()"
          color="accent"
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
      showAll: false
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
  }
};
</script>

<style></style>
