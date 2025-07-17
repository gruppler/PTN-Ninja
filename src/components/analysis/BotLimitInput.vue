<template>
  <q-input
    v-model.number="model"
    type="number"
    :min="min"
    :max="max"
    :step="step"
    :rules="[isValid]"
    hide-bottom-space
    filled
    v-bind="$attrs"
    v-on="$listeners"
  >
    <template v-if="$slots.after" v-slot:after>
      <slot name="after" />
    </template>
  </q-input>
</template>

<script>
export default {
  name: "BotLimitInput",
  props: {
    value: Number,
    type: String,
    min: Number,
    max: Number,
    step: Number,
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
  methods: {
    isValid(n) {
      return n >= this.min && n <= this.max;
    },
  },
};
</script>
