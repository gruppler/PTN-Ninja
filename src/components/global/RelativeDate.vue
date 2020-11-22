<template>
  <span v-if="textOnly">
    {{ label }}
  </span>
  <span
    v-else-if="date"
    v-bind="$attrs"
    v-on="$listeners"
    class="relative-date hover-info non-selectable text-no-wrap"
    :class="{ 'q-dark': dark }"
  >
    {{ invert ? tooltip : label }}
    <tooltip>{{ invert ? label : tooltip }}</tooltip>
  </span>
</template>

<script>
import {
  differenceInDays,
  format,
  formatDistance,
  parse,
  startOfDay,
  startOfToday
} from "date-fns";

export default {
  name: "relative-date",
  props: {
    value: [Date, Number, String],
    "text-only": Boolean,
    invert: Boolean,
    dark: Boolean
  },
  data() {
    return {
      label: "",
      timer: null
    };
  },
  computed: {
    today() {
      return startOfToday();
    },
    date() {
      return !this.value || this.value instanceof Date
        ? this.value
        : parse(this.value, this.$t("format.date-standard"), new Date());
    },
    tooltip() {
      return format(this.date, this.$t("format.date-full"));
    }
  },
  methods: {
    updateLabel() {
      const diff = differenceInDays(startOfDay(this.date), this.today);
      if (Math.abs(diff) < 2) {
        this.label = this.$t(
          diff < 0 ? "yesterday" : diff > 0 ? "tomorrow" : "today"
        );
      } else {
        this.label = formatDistance(startOfDay(this.date), this.today, {
          addSuffix: true
        });
      }
    }
  },
  watch: {
    value() {
      this.updateLabel();
    }
  },
  created() {
    this.updateLabel();
    this.timer = setInterval(this.updateLabel, 9e5);
  },
  destroyed() {
    clearInterval(this.timer);
  }
};
</script>
