<template>
  <q-card-section>
    <q-btn
      v-close-popup
      :class="{
        'float-right': !isMaximized,
        'float-left q-mr-lg': isMaximized
      }"
      :icon="isMaximized ? 'arrow_back' : 'close'"
      color="white"
      dense
      flat
    />
    <div class="text-h6 text-white"><slot /></div>
  </q-card-section>
</template>

<script>
export default {
  name: "dialog-header",
  data() {
    return {
      isMaximized: false
    };
  },
  mounted() {
    this.isMaximized = !!this.$el.closest(".q-dialog__inner--maximized");
  }
};
</script>
