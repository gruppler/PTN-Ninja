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
      </q-card-section>

      <q-separator dark />

      <q-card-actions class="row items-center justify-end q-gutter-sm">
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
export default {
  name: "Share",
  props: ["value", "game"],
  data() {
    return {};
  },
  methods: {
    close() {
      this.$emit("input", false);
    }
  }
};
</script>

<style></style>
