<template>
  <q-select
    ref="select"
    v-model="model"
    :options="listOptions"
    map-options
    emit-value
    :option-label="optionLabel"
    v-bind="$attrs"
    v-on="$listeners"
  >
    <template v-if="selectedIcon" v-slot:prepend>
      <q-icon :name="selectedIcon" />
    </template>

    <template v-slot:option="scope">
      <q-item v-bind="scope.itemProps" v-on="scope.itemEvents">
        <q-item-section v-if="scope.opt.icon" avatar>
          <q-icon :name="scope.opt.icon" />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ scope.opt[optionLabel] }}</q-item-label>
        </q-item-section>
      </q-item>
    </template>

    <template v-for="(_, slot) of $scopedSlots" v-slot:[slot]="scope">
      <slot :name="slot" v-bind="scope" />
    </template>
  </q-select>
</template>

<script>
import { cloneDeep, isArray, isString } from "lodash";

export default {
  name: "ListSelect",
  props: {
    value: [Array, String],
    options: [Array, Object],
    icon: String,
    optionLabel: {
      type: String,
      default: "label",
    },
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
    listOptions() {
      let options;
      if (isArray(this.options)) {
        options = cloneDeep(this.options);
      } else {
        options = this.options
          ? Object.keys(this.options).map((value) => ({
              value,
              ...this.options[value],
            }))
          : [];
      }
      options.forEach((opt) =>
        isString(opt)
          ? this.$te(opt)
            ? this.$t(opt)
            : opt
          : (opt[this.optionLabel] = this.$te(opt[this.optionLabel])
              ? this.$tc(opt[this.optionLabel])
              : opt[this.optionLabel])
      );
      return options;
    },
    selected() {
      return this.listOptions.find((o) => o.value === this.model) || {};
    },
    selectedIcon() {
      return this.selected.icon || this.icon || "";
    },
  },
  methods: {
    validate(value) {
      return this.$refs.select.validate(value);
    },
  },
};
</script>
