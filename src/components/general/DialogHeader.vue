<template>
  <q-card-section>
    <q-btn
      v-close-popup
      class="float-right"
      icon="close"
      color="white"
      dense
      flat
    />
    <div class="text-h6 text-white"><slot /></div>
  </q-card-section>
</template>

<script>
export default {
  name: "DialogHeader"
};
</script>
