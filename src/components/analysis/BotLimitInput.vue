<template>
  <!-- Seconds to Think -->
  <q-input
    v-if="type === 'movetime'"
    v-model.number="model"
    type="number"
    :min="500"
    :max="3e4"
    :step="500"
    filled
    v-bind="$attrs"
    v-on="$listeners"
  />

  <!-- Depth -->
  <q-input
    v-else-if="type === 'depth'"
    v-model.number="model"
    type="number"
    :min="1"
    :max="99"
    :step="1"
    filled
    v-bind="$attrs"
    v-on="$listeners"
  />

  <!-- Nodes -->
  <q-input
    v-else-if="type === 'nodes'"
    v-model.number="model"
    type="number"
    :min="1"
    :max="1e9"
    :step="1000"
    filled
    v-bind="$attrs"
    v-on="$listeners"
  />
</template>

<script>
export default {
  name: "BotLimitInput",
  props: {
    value: Number,
    type: String,
  },
  computed: {
    model: {
      get() {
        return this.value;
      },
      set(value) {
        this.$emit("input", value);
      },
    },
  },
};
</script>
