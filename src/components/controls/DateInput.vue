<template>
  <q-input
    v-show="!hidden"
    v-model="modelValueProxy"
    :label="label"
    :rules="dateRules"
    :readonly="readonly"
    hide-bottom-space
    clearable
    filled
    item-aligned
  >
    <template v-slot:prepend>
      <q-icon :name="icon" />
    </template>
    <q-popup-proxy
      v-if="!readonly"
      v-model="showDatePicker"
      @before-show="proxyDate = modelValueProxy"
      anchor="center middle"
      self="center middle"
      transition-show="none"
      transition-hide="none"
      no-refocus
    >
      <div>
        <q-date
          v-model="proxyDate"
          name="date"
          mask="YYYY.MM.DD"
          :text-color="primaryFG"
          today-btn
          :navigation-min-year-month="minDateString"
          :navigation-max-year-month="maxDateString"
          :options="dateOptionsFn"
        >
          <div class="row items-center justify-end q-gutter-sm">
            <q-btn
              :label="$t('Clear')"
              @click="modelValueProxy = null"
              flat
              v-close-popup
            />
            <div class="col-grow" />
            <q-btn :label="$t('Cancel')" flat v-close-popup />
            <q-btn
              :label="$t('OK')"
              @click="modelValueProxy = proxyDate"
              flat
              v-close-popup
            />
          </div>
        </q-date>
      </div>
    </q-popup-proxy>
  </q-input>
</template>

<script>
import { formats } from "../../Game/PTN/Tag";
import { date } from "quasar";

export default {
  name: "DateInput",
  props: {
    value: String, // isoformat  date
    label: String,
    hidden: Boolean,
    readonly: Boolean,
    min: Date,
    max: Date,
    icon: {
      type: String,
      default: "date",
    },
  },
  data() {
    return {
      proxyDate: null,
      showDatePicker: false,
      dateRules: [
        (value) => !value || formats.date.test(value),
        (value) =>
          !value ||
          !this.min ||
          new Date(this.value) > this.min ||
          `Must be after ${date.formatDate(this.min, "YYYY.MM")}`,
        (value) =>
          !value ||
          !this.max ||
          new Date(this.value) < this.max ||
          `Must be before ${date.formatDate(this.max, "YYYY.MM")}`,
      ],
    };
  },
  computed: {
    primaryFG() {
      return this.$store.state.ui.theme.primaryDark ? "textLight" : "textDark";
    },
    minDateString() {
      return this.min && date.formatDate(this.min, "YYYY/MM");
    },
    maxDateString() {
      return this.max && date.formatDate(this.max, "YYYY/MM");
    },
    modelValueProxy: {
      get() {
        if (!this.value) return this.value;
        return date.formatDate(Date.parse(this.value), "YYYY.MM.DD");
      },
      set(value) {
        const parsedDate = this.parseDate(value);
        this.$emit("input", parsedDate && parsedDate.toISOString());
      },
    },
  },
  methods: {
    parseDate(str, separator = ".") {
      if (!str) {
        return null;
      }
      const [year, month, day] = str.split(separator);
      return new Date(year, month - 1, day);
    },
    dateOptionsFn(dateStr) {
      const parsedDate = this.parseDate(dateStr, "/");
      return (
        parsedDate &&
        (!this.min || parsedDate > this.min) &&
        (!this.max || parsedDate < this.max)
      );
    },
  },
};
</script>
