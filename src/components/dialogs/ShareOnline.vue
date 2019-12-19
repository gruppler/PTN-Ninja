<template>
  <q-dialog :value="value" @input="$emit('input', $event)">
    <q-card style="width: 600px" class="bg-secondary">
      <DialogHeader>{{ $t("Play Online") }}</DialogHeader>

      <SmoothReflow class="col">
        <Recess>
          <div class="scroll" style="max-height: calc(100vh - 18.5rem)"></div>
        </Recess>
      </SmoothReflow>

      <q-separator />

      <q-card-actions align="right">
        <q-btn :label="$t('Close')" color="accent" flat v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import DialogHeader from "../general/DialogHeader";

export default {
  name: "ShareOnline",
  components: { DialogHeader },
  props: ["value", "game"],
  data() {
    return {};
  },
  methods: {
    create() {
      this.$store.dispatch("online/CREATE", this.game);
    }
  },
  watch: {
    value(isVisible) {
      if (isVisible) {
        //
      }
    }
  }
};
</script>
