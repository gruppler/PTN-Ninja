<template>
  <div :class="'text-' + textColor">
    <!-- Suggestions to Save -->
    <q-input
      type="number"
      v-model.number="pvsToSave"
      :label="$t('analysis.pvsToSave')"
      :min="1"
      :max="20"
      item-aligned
      filled
      :dark="dark"
    />

    <!-- Plies to Save -->
    <q-input
      type="number"
      v-model.number="pvLimit"
      :label="$t('analysis.pliesToSave')"
      :min="0"
      :max="20"
      item-aligned
      filled
      :dark="dark"
    />

    <!-- Save Extra Info -->
    <q-item tag="label" clickable v-ripple>
      <q-item-section>
        <q-item-label>{{ $t("analysis.saveSearchStats") }}</q-item-label>
      </q-item-section>
      <q-item-section side>
        <q-toggle v-model="saveSearchStats" :dark="dark" />
      </q-item-section>
    </q-item>

    <!-- Auto-save after Search -->
    <q-item
      @click="autoSaveAfterSearch = !autoSaveAfterSearch"
      clickable
      v-ripple
    >
      <q-item-section>
        <q-item-label>{{ $t("analysis.autoSaveAfterSearch") }}</q-item-label>
      </q-item-section>
      <q-item-section side>
        <q-toggle v-model="autoSaveAfterSearch" :dark="dark" />
      </q-item-section>
    </q-item>

    <!-- Overwrite Inferior Results -->
    <q-item @click="overwriteInferior = !overwriteInferior" clickable v-ripple>
      <q-item-section>
        <q-item-label>{{ $t("analysis.overwriteInferior") }}</q-item-label>
      </q-item-section>
      <q-item-section side>
        <q-toggle v-model="overwriteInferior" :dark="dark" />
      </q-item-section>
    </q-item>

    <q-separator :dark="dark" />

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
  name: "SavedSettings",
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
    pvsToSave: {
      get() {
        return this.$store.state.analysis.pvsToSave;
      },
      set(value) {
        this.$store.dispatch("analysis/SET", ["pvsToSave", value]);
      },
    },
    pvLimit: {
      get() {
        return this.$store.state.analysis.pvLimit;
      },
      set(value) {
        this.$store.dispatch("analysis/SET", ["pvLimit", value]);
      },
    },
    saveSearchStats: {
      get() {
        return this.$store.state.analysis.saveSearchStats;
      },
      set(value) {
        this.$store.dispatch("analysis/SET", ["saveSearchStats", value]);
      },
    },
    autoSaveAfterSearch: {
      get() {
        return this.$store.state.analysis.autoSaveAfterSearch;
      },
      set(value) {
        this.$store.dispatch("analysis/SET", ["autoSaveAfterSearch", value]);
      },
    },
    overwriteInferior: {
      get() {
        return this.$store.state.analysis.overwriteInferior;
      },
      set(value) {
        this.$store.dispatch("analysis/SET", ["overwriteInferior", value]);
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
