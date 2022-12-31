<template>
  <q-item class="q-pa-md bg-accent">
    <q-item-section v-if="icon || $slots.icon" class="items-center" avatar>
      <slot name="icon">
        <q-icon :name="icon" size="md" />
      </slot>
    </q-item-section>
    <q-item-section>
      <q-item-label class="text-h6">
        <slot>
          {{ title }}
        </slot>
      </q-item-label>
      <q-item-label
        v-if="subtitle || $slots.subtitle"
        class="text-subtitle1"
        subtitle
      >
        <slot name="subtitle">
          {{ subtitle }}
        </slot>
      </q-item-label>
    </q-item-section>
    <q-item-section class="fg-inherit" side top>
      <div class="row reverse items-center q-gutter-md">
        <q-btn v-close-popup v-if="!noCloseBtn" icon="close" dense flat>
          <hint>{{ $t("Close") }}</hint>
        </q-btn>
        <slot name="buttons" />
      </div>
    </q-item-section>
  </q-item>
</template>

<script>
export default {
  name: "dialog-header",
  props: {
    icon: String,
    title: String,
    subtitle: String,
    noCloseBtn: Boolean,
  },
};
</script>
