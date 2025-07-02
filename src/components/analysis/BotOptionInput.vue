<template>
  <!-- Checkbox -->
  <q-item
    v-if="option.type === 'check'"
    type="label"
    :disable="disable"
    clickable
    v-ripple
  >
    <q-item-section side>
      <q-checkbox v-model="model" :disable="disable" />
      <q-item-section>
        <q-item-label>{{ name }}</q-item-label>
      </q-item-section>
    </q-item-section>
  </q-item>

  <!-- Number -->
  <q-input
    v-else-if="option.type === 'spin'"
    type="number"
    v-model.number="model"
    :label="name"
    :min="option.min"
    :max="option.max"
    :disable="disable"
    v-bind="$attrs"
    v-on="$listeners"
  />

  <!-- Select List -->
  <q-select
    v-else-if="option.type === 'combo'"
    v-model="model"
    :options="option.vars"
    :label="name"
    :disable="disable"
    behavior="menu"
    transition-show="none"
    transition-hide="none"
    v-bind="$attrs"
    v-on="$listeners"
  />

  <!-- Button -->
  <q-btn
    v-else-if="option.type === 'button'"
    :label="name"
    @click="$emit('action', name)"
    :disable="disable"
    class="full-width"
    color="primary"
    stretch
    v-bind="$attrs"
    v-on="$listeners"
  />

  <!-- Text -->
  <q-input
    v-else-if="option.type === 'string'"
    v-model="model"
    :label="name"
    :disable="disable"
    v-bind="$attrs"
    v-on="$listeners"
  />
</template>

<script>
export default {
  name: "BotOptionInput",
  props: {
    value: [Boolean, Number, String],
    name: String,
    option: Object,
    disable: Boolean,
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
