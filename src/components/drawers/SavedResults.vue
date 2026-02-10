<template>
  <div>
    <q-expansion-item
      v-model="sections.savedResults"
      header-class="bg-accent"
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
              </q-list>
            </q-menu>
          </q-btn>
        </q-item-section>
      </template>

      <recess>
        <!-- Saved Results by Bot -->
        <div
          v-for="(botName, index) in savedBotNames"
          :key="botName || 'other'"
        >
          <q-separator v-if="index > 0" :dark="dark" />
          <SavedBotResults :bot-name="botName" :index="index" />
        </div>

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
    };
  },
  computed: {
    dark() {
      return this.$store.state.ui.theme.panelDark;
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
  },
  methods: {
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
