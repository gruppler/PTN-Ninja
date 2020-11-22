<template>
  <span v-if="textOnly">
    {{ label }}
  </span>
  <span
    v-else-if="date"
    v-bind="$attrs"
    v-on="$listeners"
    class="relative-time hover-info non-selectable text-no-wrap"
    :class="{ 'q-dark': dark }"
  >
    {{ invert ? tooltip : label }}
    <tooltip>{{ invert ? label : tooltip }}</tooltip>
  </span>
</template>

<script>
import { format, formatDistanceToNow } from "date-fns";
import { timestampToDate } from "../../utilities";

export default {
  name: "relative-time",
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
    date() {
      return timestampToDate(this.value);
    },
    tooltip() {
      return format(this.date, this.$t("format.date-time-full"));
    }
  },
  methods: {
    updateLabel() {
      this.label = formatDistanceToNow(this.date, { addSuffix: true });
    }
  },
  watch: {
    value() {
      this.updateLabel();
    }
  },
  created() {
    this.updateLabel();
    this.timer = setInterval(this.updateLabel, 15e3);
  },
  destroyed() {
    clearInterval(this.timer);
  }
};
</script>
