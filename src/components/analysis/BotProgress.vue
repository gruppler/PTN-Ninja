<template>
  <q-btn v-on="$listeners" v-bind="$attrs">
    <template v-if="isRunning">
      <q-spinner-cube v-if="interactive" :size="size" />
      <q-circular-progress
        v-else
        :value="progress"
        :indeterminate="indeterminate"
        :size="size"
        :thickness="0.2"
      />
    </template>
    <q-icon v-else :name="icon" :size="size" />
    <hint v-if="hint || isRunning">{{ isRunning ? "Cancel" : hint }}</hint>
  </q-btn>
</template>

<script>
export default {
  name: "BotProgress",
  props: {
    isRunning: {
      type: Boolean,
      default: false,
    },
    interactive: {
      type: Boolean,
      default: false,
    },
    icon: {
      type: String,
    },
    progress: {
      type: Number,
      default: 0,
    },
    size: {
      type: String,
      default: "sm",
    },
    hint: {
      type: String,
      default: "",
    },
  },
  computed: {
    indeterminate() {
      return this.isRunning && (this.progress === null || this.progress === 0);
    },
  },
};
</script>
