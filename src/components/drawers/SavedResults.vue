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
      // Get unique bot names from all saved suggestions across all positions
      // Order: active bots first (in order), then other named bots, then null (Other)
      const botNameSet = new Set();
      const allPlies = this.game.ptn && this.game.ptn.allPlies;

      const collectBotNames = (tps) => {
        if (!tps) return;
        const suggestions = this.$store.getters["game/suggestions"](tps);
        for (const s of suggestions) {
          botNameSet.add(s.botName); // null for unnamed
        }
      };

      // Check initial position
      if (allPlies && allPlies[0] && allPlies[0].tpsBefore) {
        collectBotNames(allPlies[0].tpsBefore);
      }

      // Check all positions
      if (allPlies) {
        for (const ply of allPlies) {
          if (ply) collectBotNames(ply.tpsAfter);
        }
      }

      // Build ordered list: just use the exact names from saved suggestions
      // Sort alphabetically, with null (Other) at the end
      const result = [];

      // Add all named bots (sorted alphabetically)
      const namedBots = [...botNameSet].filter((name) => name !== null);
      namedBots.sort((a, b) => a.localeCompare(b));
      result.push(...namedBots);

      // Add null (Other) at the end if present
      if (botNameSet.has(null)) {
        result.push(null);
      }

      return result;
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
