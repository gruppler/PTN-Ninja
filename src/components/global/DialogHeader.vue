<template>
  <q-item class="q-pa-md bg-accent">
    <q-item-section v-if="icon" class="items-center" avatar>
      <slot name="avatar">
        <q-icon :name="icon" size="md" />
      </slot>
    </q-item-section>
    <q-item-section>
      <q-item-label class="text-h6">
        <slot>
          {{ title }}
        </slot>
      </q-item-label>
    </q-item-section>
    <q-item-section v-if="!noCloseBtn" side>
      <q-btn v-close-popup icon="close" dense flat />
    </q-item-section>
  </q-item>
</template>

<script>
export default {
  name: "dialog-header",
  props: {
    icon: String,
    title: String,
    noCloseBtn: Boolean,
  },
};
</script>
