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

    <!-- Show Evaluation Marks -->
    <q-item @click="showEvalMarks = !showEvalMarks" clickable v-ripple>
      <q-item-section>
        <q-item-label>{{ $t("analysis.showEvalMarks") }}</q-item-label>
      </q-item-section>
      <q-item-section side>
        <q-toggle v-model="showEvalMarks" :dark="dark" />
      </q-item-section>
    </q-item>

    <!-- Evaluation Mark Thresholds -->
    <smooth-reflow>
      <template v-if="showEvalMarks">
        <q-item-label :class="'text-' + textColor" header>{{
          $t("analysis.evalMarkThresholds")
        }}</q-item-label>
        <q-input
          type="number"
          v-model.number="evalMarkThresholds.brilliant"
          :label="$t('analysis.thresholds.brilliant')"
          :step="0.01"
          :min="0.01"
          hide-bottom-space
          :dark="dark"
          filled
          item-aligned
        />
        <q-input
          type="number"
          v-model.number="evalMarkThresholds.good"
          :label="$t('analysis.thresholds.good')"
          :step="0.01"
          :min="0.01"
          hide-bottom-space
          :dark="dark"
          filled
          item-aligned
        />
        <q-input
          type="number"
          v-model.number="evalMarkThresholds.bad"
          :label="$t('analysis.thresholds.bad')"
          :step="0.01"
          :max="-0.01"
          hide-bottom-space
          :dark="dark"
          filled
          item-aligned
        />
        <q-input
          type="number"
          v-model.number="evalMarkThresholds.blunder"
          :label="$t('analysis.thresholds.blunder')"
          :step="0.01"
          :max="-0.01"
          hide-bottom-space
          :dark="dark"
          filled
          item-aligned
        />
      </template>
    </smooth-reflow>
  </div>
</template>

<script>
import { cloneDeep, isEqual } from "lodash";

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
    evalMarkThresholds: {
      get() {
        return this.localEvalMarkThresholds;
      },
      set(value) {
        this.localEvalMarkThresholds = value;
      },
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
