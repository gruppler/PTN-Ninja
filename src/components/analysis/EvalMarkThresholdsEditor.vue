<template>
  <div>
    <q-item-label v-if="showHeader" :class="textClass" header>{{
      $t("analysis.evalMarkThresholds")
    }}</q-item-label>
    <q-item>
      <q-item-section>
        <div class="threshold-inputs">
          <div class="row no-wrap q-col-gutter-x-sm">
            <q-input
              class="col-3"
              :value="thresholds.blunder"
              type="number"
              :label="$t('analysis.thresholds.blunder')"
              :max="thresholds.bad - 1"
              :step="1"
              suffix="cp"
              :dark="dark"
              dense
              filled
              hide-bottom-space
              @input="(v) => updateField('blunder', v)"
              @blur="clampThreshold('blunder')"
            />
            <q-input
              class="col-3"
              :value="thresholds.bad"
              type="number"
              :label="$t('analysis.thresholds.bad')"
              :min="thresholds.blunder + 1"
              :max="-1"
              :step="1"
              suffix="cp"
              :dark="dark"
              dense
              filled
              hide-bottom-space
              @input="(v) => updateField('bad', v)"
              @blur="clampThreshold('bad')"
            />
            <q-input
              class="col-3"
              :value="thresholds.good"
              type="number"
              :label="$t('analysis.thresholds.good')"
              :min="1"
              :max="thresholds.brilliant - 1"
              :step="1"
              suffix="cp"
              :dark="dark"
              dense
              filled
              hide-bottom-space
              @input="(v) => updateField('good', v)"
              @blur="clampThreshold('good')"
            />
            <q-input
              class="col-3"
              :value="thresholds.brilliant"
              type="number"
              :label="$t('analysis.thresholds.brilliant')"
              :min="thresholds.good + 1"
              :step="1"
              suffix="cp"
              :dark="dark"
              dense
              filled
              hide-bottom-space
              @input="(v) => updateField('brilliant', v)"
              @blur="clampThreshold('brilliant')"
            />
          </div>
        </div>
        <div class="threshold-compound q-mt-xl relative-position">
          <div class="threshold-track"></div>
          <div
            class="threshold-fill"
            :style="thresholdFillStyles.negative"
          ></div>
          <div
            class="threshold-fill"
            :style="thresholdFillStyles.positive"
          ></div>
          <div class="row no-wrap threshold-slider-row">
            <q-range
              class="col threshold-range"
              v-model="negativeRange"
              :min="negativeSliderMin"
              :max="-1"
              :step="1"
              color="transparent"
              track-color="transparent"
              thumb-color="primary"
              label-always
              left-label-value="??"
              left-label-color="primary"
              :left-label-text-color="primaryFG"
              right-label-value="?"
              right-label-color="primary"
              :right-label-text-color="primaryFG"
            />
            <q-separator vertical />
            <q-range
              class="col threshold-range"
              v-model="positiveRange"
              :min="1"
              :max="positiveSliderMax"
              :step="1"
              color="transparent"
              track-color="transparent"
              thumb-color="primary"
              label-always
              left-label-value="!"
              left-label-color="primary"
              :left-label-text-color="primaryFG"
              right-label-value="!!"
              right-label-color="primary"
              :right-label-text-color="primaryFG"
            />
          </div>
        </div>
      </q-item-section>
    </q-item>
    <q-item>
      <q-item-section>
        <q-btn
          @click="resetThresholds"
          :label="$t('Reset')"
          :disable="isDefault"
          :flat="isDefault"
          color="primary"
          dense
        />
      </q-item-section>
    </q-item>
  </div>
</template>

<script>
import { cloneDeep, isEqual } from "lodash";
import { defaultEvalMarkThresholds } from "../../bots/bot";

export default {
  name: "EvalMarkThresholdsEditor",
  props: {
    value: {
      type: Object,
      default: null,
    },
    // Default to null so Quasar auto-detects dark mode from the surrounding
    // context; pass `true`/`false` explicitly to force a value.
    dark: {
      type: Boolean,
      default: null,
    },
    textClass: {
      type: [String, Array, Object],
      default: null,
    },
    showHeader: {
      type: Boolean,
      default: true,
    },
  },
  computed: {
    thresholds() {
      return this.value || defaultEvalMarkThresholds;
    },
    isDefault() {
      return isEqual(this.thresholds, defaultEvalMarkThresholds);
    },
    primaryFG() {
      return this.$store.state.ui.theme.primaryDark ? "textLight" : "textDark";
    },
    // Slider bounds expand if user enters a more extreme value in the inputs,
    // so the slider thumb stays in sync with the underlying value.
    negativeSliderMin() {
      const blunder = this.thresholds.blunder;
      return Math.min(-50, blunder || -50);
    },
    positiveSliderMax() {
      const brilliant = this.thresholds.brilliant;
      return Math.max(50, brilliant || 50);
    },
    negativeRange: {
      get() {
        const T = this.thresholds;
        return { min: T.blunder, max: T.bad };
      },
      set({ min, max }) {
        this.emitUpdate({ blunder: min, bad: max });
      },
    },
    positiveRange: {
      get() {
        const T = this.thresholds;
        return { min: T.good, max: T.brilliant };
      },
      set({ min, max }) {
        this.emitUpdate({ good: min, brilliant: max });
      },
    },
    // Two fill bars visualise the "marked" zones:
    //   negative: from the slider's far-left edge to the bad thumb (?? and ?)
    //   positive: from the good thumb to the slider's far-right edge (! and !!)
    thresholdFillStyles() {
      const T = this.thresholds;
      const negMin = this.negativeSliderMin;
      const negRange = -1 - negMin;
      const badRatio = negRange > 0 ? (T.bad - negMin) / negRange : 0;
      const posMax = this.positiveSliderMax;
      const posRange = posMax - 1;
      const goodRatio = posRange > 0 ? (T.good - 1) / posRange : 0;
      return {
        negative: { left: "0%", right: `${100 - badRatio * 50}%` },
        positive: { left: `${50 + goodRatio * 50}%`, right: "0%" },
      };
    },
  },
  methods: {
    emitUpdate(changes) {
      this.$emit("input", { ...this.thresholds, ...changes });
    },
    updateField(key, value) {
      const parsed = value === "" || value === null ? null : Number(value);
      this.emitUpdate({ [key]: parsed });
    },
    resetThresholds() {
      this.$emit("input", cloneDeep(defaultEvalMarkThresholds));
    },
    clampThreshold(key) {
      const T = this.thresholds;
      const v = T[key];
      const changes = {};
      if (!Number.isFinite(v)) {
        changes[key] = cloneDeep(defaultEvalMarkThresholds)[key];
        this.emitUpdate(changes);
        return;
      }
      switch (key) {
        case "blunder":
          changes.blunder = Math.min(Math.round(v), T.bad - 1);
          break;
        case "bad":
          changes.bad = Math.max(T.blunder + 1, Math.min(Math.round(v), -1));
          break;
        case "good":
          changes.good = Math.max(1, Math.min(Math.round(v), T.brilliant - 1));
          break;
        case "brilliant":
          changes.brilliant = Math.max(Math.round(v), T.good + 1);
          break;
      }
      this.emitUpdate(changes);
    },
  },
};
</script>

<style lang="scss" scoped>
.threshold-inputs {
  margin: 0 auto;
  max-width: 30em;
}
.threshold-track,
.threshold-fill {
  position: absolute;
  top: 50%;
  height: 4px;
  transform: translateY(-50%);
  border-radius: 2px;
  pointer-events: none;
}
.threshold-track {
  left: 0;
  right: 0;
  background: rgba(255, 255, 255, 0.12);
}
.threshold-fill {
  background: var(--q-color-primary);
  transition: left 0.28s, right 0.28s;
}
.threshold-slider-row {
  position: relative;
}
.threshold-range ::v-deep .q-slider__text {
  font-weight: bold;
}
// Keep the thumb visible while dragging; Quasar hides it by default when a
// label is present, but our label-always pin and the thumb should coexist.
.threshold-range.q-slider--active.q-slider--label
  ::v-deep
  .q-slider__thumb-shape {
  transform: scale(1.5) !important;
}
</style>
