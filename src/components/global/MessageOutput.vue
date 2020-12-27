<template>
  <smooth-reflow>
    <div v-if="error" class="row no-wrap text-negative" :class="contentClass">
      <q-icon name="error" size="sm" left />
      {{ formatError(error) }}
    </div>
    <div v-if="success" class="row no-wrap text-positive" :class="contentClass">
      <q-icon name="success" size="sm" left />
      {{ formatSuccess(success) }}
    </div>
    <div v-if="warning" class="row no-wrap text-warning" :class="contentClass">
      <q-icon name="warning" size="sm" left />
      {{ formatWarning(warning) }}
    </div>
    <div v-if="hint" class="row no-wrap" :class="contentClass">
      {{ formatHint(hint) }}
    </div>
  </smooth-reflow>
</template>

<script>
import {
  formatError,
  formatSuccess,
  formatWarning,
  formatHint,
} from "../../utilities";

export default {
  name: "message-output",
  props: ["error", "success", "warning", "hint", "content-class"],
  methods: {
    formatError,
    formatSuccess,
    formatWarning,
    formatHint,
  },
};
</script>
