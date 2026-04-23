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

    <q-select
      v-model="evalType"
      :label="$t('analysis.evalType')"
      :options="evalTypeOptions"
      behavior="menu"
      transition-show="none"
      transition-hide="none"
      emit-value
      map-options
      :dark="dark"
      item-aligned
      filled
    />

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
  </div>
</template>

<script>
export default {
  name: "EnginesSettings",
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
    evalType: {
      get() {
        return this.$store.state.analysis.evalType;
      },
      set(value) {
        this.$store.dispatch("analysis/SET", ["evalType", value]);
      },
    },
    evalTypeOptions() {
      return [
        {
          label: this.$t("analysis.evalTypes.advantage"),
          value: "advantage",
        },
        {
          label: this.$t("analysis.evalTypes.cp"),
          value: "cp",
        },
        {
          label: this.$t("analysis.evalTypes.wdl"),
          value: "wdl",
        },
      ];
    },
  },
};
</script>
