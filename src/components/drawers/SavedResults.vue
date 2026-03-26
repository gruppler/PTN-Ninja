<template>
  <div>
    <q-expansion-item
      v-model="sections.savedResults"
      header-class="bg-accent"
      class="saved-results"
      expand-icon-class="fg-inherit"
      default-opened
    >
      <template v-slot:header>
        <q-item-section avatar>
          <q-icon name="save" />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ $t("Saved Results") }}</q-item-label>
        </q-item-section>
        <q-item-section class="fg-inherit" side>
          <div class="row no-wrap q-gutter-x-sm">
            <q-btn
              @click.stop="toggleSettings"
              icon="settings"
              :color="showSettings ? 'primary' : ''"
              dense
              round
              flat
            />
            <q-btn
              @click.stop
              icon="delete"
              :disable="!savedBotNames.length"
              dense
              round
              flat
            >
              <q-menu auto-close>
                <q-list>
                  <q-item
                    clickable
                    :disable="!hasPositionSavedResults"
                    @click="deletePositionSavedResults"
                  >
                    <q-item-section avatar>
                      <q-icon name="delete" />
                    </q-item-section>
                    <q-item-section>{{
                      $t("analysis.Delete Positions Saved Results")
                    }}</q-item-section>
                  </q-item>
                  <q-item clickable @click="deleteAllSavedResults">
                    <q-item-section avatar>
                      <q-icon name="delete_all" />
                    </q-item-section>
                    <q-item-section>{{
                      $t("analysis.Delete All Saved Results")
                    }}</q-item-section>
                  </q-item>

                  <q-separator />

                  <q-item
                    clickable
                    @click="removeEvalMarks"
                    :disable="!hasEvalMarks"
                  >
                    <q-item-section avatar>
                      <q-icon name="eval" />
                    </q-item-section>
                    <q-item-section>{{
                      $t("analysis.removeEvalMarks")
                    }}</q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-btn>
          </div>
        </q-item-section>
      </template>

      <recess>
        <smooth-reflow height-only class="bg-panel-opaque">
          <template v-if="showSettings">
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
            <q-item :class="textClass" tag="label" clickable v-ripple>
              <q-item-section>
                <q-item-label>{{
                  $t("analysis.saveSearchStats")
                }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle v-model="saveSearchStats" :dark="dark" />
              </q-item-section>
            </q-item>

            <!-- Auto-save after each Position -->
            <q-item
              :class="textClass"
              @click="autoSaveEachPosition = !autoSaveEachPosition"
              clickable
              v-ripple
            >
              <q-item-section>
                <q-item-label>{{
                  $t("analysis.autoSaveEachPosition")
                }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle v-model="autoSaveEachPosition" :dark="dark" />
              </q-item-section>
            </q-item>

            <!-- Auto-save on Search Completion -->
            <q-item
              :class="textClass"
              @click="autoSaveOnSearchComplete = !autoSaveOnSearchComplete"
              clickable
              v-ripple
            >
              <q-item-section>
                <q-item-label>{{
                  $t("analysis.autoSaveOnSearchComplete")
                }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle v-model="autoSaveOnSearchComplete" :dark="dark" />
              </q-item-section>
            </q-item>

            <!-- Overwrite Inferior Results -->
            <q-item
              :class="textClass"
              @click="overwriteInferior = !overwriteInferior"
              clickable
              v-ripple
            >
              <q-item-section>
                <q-item-label>{{
                  $t("analysis.overwriteInferior")
                }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle v-model="overwriteInferior" :dark="dark" />
              </q-item-section>
            </q-item>

            <q-separator :dark="dark" />
          </template>
        </smooth-reflow>

        <!-- Saved Results by Bot -->
        <div
          v-for="(botName, index) in savedBotNames"
          :key="botName || 'other'"
        >
          <q-separator v-if="index > 0" :dark="dark" />
          <SavedBotResults :bot-name="botName" :index="index" />
        </div>
        <q-item
          v-if="!savedBotNames.length"
          class="flex-center text-center"
          :class="textClass"
        >
          {{ $t("analysis.noSavedResults") }}
        </q-item>

        <q-separator :dark="dark" />
      </recess>
    </q-expansion-item>
  </div>
</template>

<script>
import SavedBotResults from "./SavedBotResults.vue";
import { cloneDeep } from "lodash";

export default {
  name: "SavedResults",
  components: {
    SavedBotResults,
  },
  data() {
    return {
      sections: cloneDeep(this.$store.state.ui.analysisSections),
      showSettings: false,
    };
  },
  computed: {
    dark() {
      return this.$store.state.ui.theme.panelDark;
    },
    textClass() {
      return this.$store.state.ui.theme.panelDark
        ? "text-textLight"
        : "text-textDark";
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
    autoSaveEachPosition: {
      get() {
        return this.$store.state.analysis.autoSaveEachPosition;
      },
      set(value) {
        this.$store.dispatch("analysis/SET", ["autoSaveEachPosition", value]);
      },
    },
    autoSaveOnSearchComplete: {
      get() {
        return this.$store.state.analysis.autoSaveOnSearchComplete;
      },
      set(value) {
        this.$store.dispatch("analysis/SET", [
          "autoSaveOnSearchComplete",
          value,
        ]);
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
    game() {
      return this.$store.state.game;
    },
    tps() {
      return this.game.position.tps;
    },
    hasPositionSavedResults() {
      const suggestions = this.$store.getters["game/suggestions"](this.tps);
      return suggestions && suggestions.length > 0;
    },
    savedBotNames() {
      return this.$store.getters["analysis/savedBotNames"];
    },
    hasEvalMarks() {
      const allPlies = this.game.ptn && this.game.ptn.allPlies;
      if (!allPlies) return false;
      for (let i = 0; i < allPlies.length; i++) {
        const ply = allPlies[i];
        if (
          ply &&
          ply.evaluation &&
          (ply.evaluation["?"] || ply.evaluation["!"])
        ) {
          return true;
        }
      }
      return false;
    },
  },
  methods: {
    toggleSettings() {
      this.showSettings = !this.showSettings;
      if (this.showSettings) {
        this.sections.savedResults = true;
      }
    },
    deletePositionSavedResults() {
      if (!this.hasPositionSavedResults) return;
      this.$store.dispatch("game/REMOVE_POSITION_ANALYSIS_NOTES", this.tps);
      this.notifyUndo({
        icon: "delete",
        message: this.$t("success.resultsDeleted"),
        handler: () => {
          this.$store.dispatch("game/UNDO");
        },
      });
    },
    deleteAllSavedResults() {
      if (!this.savedBotNames.length) return;
      this.$store.dispatch("game/REMOVE_ANALYSIS_NOTES");
      this.notifyUndo({
        icon: "delete_all",
        message: this.$t("success.resultsDeleted"),
        handler: () => {
          this.$store.dispatch("game/UNDO");
        },
      });
    },
    removeEvalMarks() {
      this.$store.dispatch("game/REMOVE_EVAL_MARKS");
      this.notifyUndo({
        icon: "eval",
        message: this.$t("success.evalMarksRemoved"),
        handler: () => {
          this.$store.dispatch("game/UNDO");
        },
      });
    },
  },
  watch: {
    "sections.savedResults"(value) {
      const storeValue = this.$store.state.ui.analysisSections;
      if (storeValue.savedResults !== value) {
        this.$store.dispatch("ui/SET_UI", [
          "analysisSections",
          { ...storeValue, savedResults: value },
        ]);
      }
    },
    "$store.state.ui.analysisSections.savedResults"(value) {
      if (this.sections.savedResults !== value) {
        this.sections.savedResults = value;
      }
    },
  },
};
</script>
