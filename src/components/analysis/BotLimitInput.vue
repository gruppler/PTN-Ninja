<template>
  <q-input
    ref="input"
    :value="display"
    type="text"
    inputmode="numeric"
    :rules="[isValid]"
    hide-bottom-space
    filled
    v-bind="$attrs"
    v-on="listeners"
    @input="onInput"
    @keydown.up.prevent="nudge(1)"
    @keydown.down.prevent="nudge(-1)"
  >
    <template v-if="$slots.after" v-slot:after>
      <slot name="after" />
    </template>
  </q-input>
</template>

<script>
// A text input rather than type="number" so the value can be shown with
// thousands separators, which makes 1,000,000 vs 10,000,000 legible at a
// glance. Limits are integers, so anything but digits is discarded.
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
    // Everything but `input`, which this component re-emits parsed.
    listeners() {
      const { input, ...listeners } = this.$listeners;
      return listeners;
    },
    display() {
      return Number.isFinite(this.value) ? this.value.toLocaleString() : "";
    },
  },
  methods: {
    isValid(n) {
      const value = typeof n === "string" ? this.parse(n) : n;
      return value >= this.min && value <= this.max;
    },
    parse(text) {
      const digits = String(text).replace(/\D/g, "");
      return digits ? parseInt(digits, 10) : null;
    },
    onInput(text) {
      const value = this.parse(text);
      const native = this.$refs.input && this.$refs.input.getNativeElement();
      // Digits before the caret, so it can be put back after reformatting.
      const caret =
        native && native.selectionStart !== null
          ? String(text).slice(0, native.selectionStart).replace(/\D/g, "")
              .length
          : null;

      this.$emit("input", value);

      this.$nextTick(() => {
        if (!native) return;
        // The prop may not have changed (e.g. a rejected character), in which
        // case Vue won't re-render; make sure the field shows the formatted
        // value regardless.
        if (native.value !== this.display) {
          native.value = this.display;
        }
        if (caret !== null) {
          let pos = 0;
          let seen = 0;
          while (pos < native.value.length && seen < caret) {
            if (/\d/.test(native.value[pos])) seen++;
            pos++;
          }
          native.setSelectionRange(pos, pos);
        }
      });
    },
    nudge(direction) {
      const step = this.step || 1;
      const current = Number.isFinite(this.value) ? this.value : 0;
      let value = current + direction * step;
      if (Number.isFinite(this.min)) value = Math.max(value, this.min);
      if (Number.isFinite(this.max)) value = Math.min(value, this.max);
      this.$emit("input", value);
    },
  },
};
</script>
