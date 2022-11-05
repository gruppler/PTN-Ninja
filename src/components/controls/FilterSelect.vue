<template>
  <q-select
    ref="select"
    v-model="model"
    :options="filteredOptions"
    :rules="filterRules"
    @filter="filter"
    @input-value="inputValue"
    map-options
    emit-value
    use-input
    fill-input
    hide-selected
    hide-bottom-space
    input-debounce="0"
    v-bind="$attrs"
    v-on="$listeners"
  >
    <template v-slot:option="scope">
      <q-item v-bind="scope.itemProps" v-on="scope.itemEvents">
        <q-item-section v-if="scope.opt.icon" avatar>
          <q-icon :name="scope.opt.icon" />
        </q-item-section>
        <q-item-section>
          <q-item-label v-if="multiple && scope.opt.includes(', ')">
            {{ scope.opt.substr(scope.opt.lastIndexOf(", ") + 2) }}
          </q-item-label>
          <q-item-label v-else-if="scope.opt[optionLabel]">
            {{ scope.opt[optionLabel] }}
          </q-item-label>
          <q-item-label v-else>{{ scope.opt }}</q-item-label>
        </q-item-section>
      </q-item>
    </template>
    <template v-for="(_, slot) of $scopedSlots" v-slot:[slot]="scope">
      <slot :name="slot" v-bind="scope" />
    </template>
  </q-select>
</template>

<script>
import { cloneDeep, compact, isArray, isString } from "lodash";
import Fuse from "fuse.js";

export default {
  name: "FilterSelect",
  props: {
    value: [Array, String],
    options: [Array, Object],
    rules: Array,
    multiple: Boolean,
    valuesOnly: Boolean,
    existingOnly: Boolean,
    showAll: Boolean,
    optionValue: {
      type: String,
      default: "value",
    },
    optionLabel: {
      type: String,
      default: "label",
    },
  },
  data() {
    const listOptions = this.getOptions();
    return {
      listOptions,
      filteredOptions: listOptions,
    };
  },
  computed: {
    model: {
      get() {
        return this.multiple && isArray(this.value)
          ? this.value.join(", ")
          : this.value;
      },
      set(value) {
        if (this.multiple) {
          if (!isArray(value)) {
            value = value.split(", ");
          }
          value = compact(value);
        }
        this.$emit("input", value);
      },
    },
    filterRules() {
      const rules = this.rules ? [...this.rules] : [];
      if (this.existingOnly) {
        rules.push((item) => this.listOptions.includes(item));
      }
      return rules;
    },
    hasError() {
      return this.$refs.select.hasError;
    },
    index() {
      return new Fuse(this.listOptions, {
        keys: ["label"],
        threshold: 0.45,
      });
    },
    lowercaseListOptions() {
      return this.valuesOnly
        ? this.listOptions.map((o) => o.toLowerCase())
        : this.listOptions.map((o) => o.label.toLowerCase());
    },
  },
  methods: {
    getOptions() {
      let options;
      if (isArray(this.options)) {
        options = cloneDeep(this.options);
      } else {
        options = this.options
          ? Object.keys(this.options)
              .sort()
              .map((value) => ({
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
          : (opt.label = this.$te(opt.label) ? this.$tc(opt.label) : opt.label)
      );
      return options;
    },
    filter(value, update) {
      let values;
      if (this.multiple) {
        values = value.split(",").map((v) => v.trim());
        value = values.pop();
      } else {
        value = value.trim();
      }

      update(
        () => {
          if (value.length === 0) {
            // Empty input
            if (this.showAll) {
              // Show all options
              this.filteredOptions = this.listOptions;
            } else {
              // Hide options until something is typed
              this.filteredOptions = [];
            }
          } else {
            // Search index
            this.filteredOptions = this.index
              .search(value)
              .filter((result) =>
                values ? !values.includes(result.item) : true
              )
              .map((result) =>
                values ? [...values, result.item].join(", ") : result.item
              );
          }
        },
        (ref) => {
          // Auto-select an option
          if (this.existingOnly && value !== "" && ref.options.length > 0) {
            ref.setOptionIndex(-1);
            ref.moveOptionSelection(1, true);
          }
        }
      );
    },
    inputValue(value = "") {
      if (this.existingOnly) {
        return;
      }

      // Ignoring case, find an existing version of the option
      // and use it if it exists, otherwise use the input value
      if (this.multiple) {
        // Multiple
        if (!isArray(value)) {
          value = value.split(",");
        }
        const values = compact(value.map((v) => v.trim()));
        const lowerValues = value.map((v) => v.toLowerCase());
        const options = [];
        lowerValues.forEach((value, i) => {
          const index = this.lowercaseListOptions.indexOf(value.toLowerCase());
          if (index >= 0) {
            options[i] = this.valuesOnly
              ? this.listOptions[index]
              : this.listOptions[index][this.optionValue];
          } else {
            options[i] = values[i];
          }
        });
        this.model = options;
      } else {
        // Single
        const index = this.lowercaseListOptions.indexOf(value.toLowerCase());
        if (index >= 0) {
          this.model = this.valuesOnly
            ? this.listOptions[index]
            : this.listOptions[index][this.optionValue];
        } else {
          this.model = value;
        }
      }
    },
  },
  watch: {
    options() {
      this.listOptions = this.getOptions();
    },
  },
};
</script>
