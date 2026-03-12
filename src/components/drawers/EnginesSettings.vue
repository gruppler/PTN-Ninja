<template>
  <div :class="'text-' + textColor">
    <!-- Show Continuation -->
    <q-item
      @click="showContinuationToggle = !showContinuationToggle"
      clickable
      v-ripple
    >
      <q-item-section>
        <q-item-label>{{ $t("analysis.showContinuation") }}</q-item-label>
      </q-item-section>
      <q-item-section side>
        <q-toggle v-model="showContinuationToggle" :dark="dark" />
      </q-item-section>
    </q-item>

    <!-- Show Full Suggestion -->
    <smooth-reflow>
      <q-item
        v-if="showContinuationToggle"
        @click="showFullPVsToggle = !showFullPVsToggle"
        clickable
        v-ripple
      >
        <q-item-section>
          <q-item-label>{{ $t("analysis.showFullSuggestion") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle v-model="showFullPVsToggle" :dark="dark" />
        </q-item-section>
      </q-item>
    </smooth-reflow>

    <q-separator :dark="dark" />

    <!-- Engine Evaluation Marks -->
    <q-item @click="showEvalMarks = !showEvalMarks" clickable v-ripple>
      <q-item-section>
        <q-item-label>{{ $t("analysis.engineEvalMarks") }}</q-item-label>
      </q-item-section>
      <q-item-section side>
        <q-toggle v-model="showEvalMarks" :dark="dark" />
      </q-item-section>
    </q-item>

    <!-- Evaluation Mark Thresholds -->
    <q-item-label :class="'text-' + textColor" header>{{
      $t("analysis.evalMarkThresholds")
    }}</q-item-label>
    <q-input
      type="number"
      v-model.number="thresholdBrilliant"
      :label="$t('analysis.thresholds.brilliant')"
      :step="1"
      :min="1"
      suffix="%"
      hide-bottom-space
      :dark="dark"
      filled
      item-aligned
    />
    <q-input
      type="number"
      v-model.number="thresholdGood"
      :label="$t('analysis.thresholds.good')"
      :step="1"
      :min="1"
      suffix="%"
      hide-bottom-space
      :dark="dark"
      filled
      item-aligned
    />
    <q-input
      type="number"
      v-model.number="thresholdBad"
      :label="$t('analysis.thresholds.bad')"
      :step="1"
      :max="-1"
      suffix="%"
      hide-bottom-space
      :dark="dark"
      filled
      item-aligned
    />
    <q-input
      type="number"
      v-model.number="thresholdBlunder"
      :label="$t('analysis.thresholds.blunder')"
      :step="1"
      :max="-1"
      suffix="%"
      hide-bottom-space
      :dark="dark"
      filled
      item-aligned
    />
    <q-item>
      <q-item-section>
        <q-btn
          @click="resetThresholds"
          :label="$t('Reset')"
          :disable="isDefaultThresholds"
          :flat="isDefaultThresholds"
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
  name: "EnginesSettings",
  data() {
    return {
      localEvalMarkThresholds: cloneDeep(
        this.$store.state.analysis.evalMarkThresholds
      ),
    };
  },
  computed: {
    dark() {
      return this.$store.state.ui.theme.isDark;
    },
    textColor() {
      return this.dark ? "textLight" : "textDark";
    },
    showContinuationToggle: {
      get() {
        return this.$store.state.analysis.showContinuation;
      },
      set(value) {
        this.$store.dispatch("analysis/SET", ["showContinuation", value]);
      },
    },
    showFullPVsToggle: {
      get() {
        return this.$store.state.analysis.showFullPVs;
      },
      set(value) {
        this.$store.dispatch("analysis/SET", ["showFullPVs", value]);
      },
    },
    showEvalMarks: {
      get() {
        return this.$store.state.analysis.showEvalMarks;
      },
      set(value) {
        this.$store.dispatch("analysis/SET", ["showEvalMarks", value]);
      },
    },
    thresholdBrilliant: {
      get() {
        return Math.round(this.localEvalMarkThresholds.brilliant * 100);
      },
      set(value) {
        this.localEvalMarkThresholds.brilliant = value / 100;
      },
    },
    thresholdGood: {
      get() {
        return Math.round(this.localEvalMarkThresholds.good * 100);
      },
      set(value) {
        this.localEvalMarkThresholds.good = value / 100;
      },
    },
    thresholdBad: {
      get() {
        return Math.round(this.localEvalMarkThresholds.bad * 100);
      },
      set(value) {
        this.localEvalMarkThresholds.bad = value / 100;
      },
    },
    thresholdBlunder: {
      get() {
        return Math.round(this.localEvalMarkThresholds.blunder * 100);
      },
      set(value) {
        this.localEvalMarkThresholds.blunder = value / 100;
      },
    },
    isDefaultThresholds() {
      return isEqual(this.localEvalMarkThresholds, defaultEvalMarkThresholds);
    },
  },
  methods: {
    resetThresholds() {
      this.localEvalMarkThresholds = cloneDeep(defaultEvalMarkThresholds);
    },
  },
  watch: {
    localEvalMarkThresholds: {
      handler(value) {
        const storeValue = this.$store.state.analysis.evalMarkThresholds;
        if (!isEqual(value, storeValue)) {
          this.$store.dispatch("analysis/SET", [
            "evalMarkThresholds",
            cloneDeep(value),
          ]);
        }
      },
      deep: true,
    },
    "$store.state.analysis.evalMarkThresholds": {
      handler(value) {
        if (!isEqual(value, this.localEvalMarkThresholds)) {
          this.localEvalMarkThresholds = cloneDeep(value);
        }
      },
      deep: true,
    },
  },
};
</script>
