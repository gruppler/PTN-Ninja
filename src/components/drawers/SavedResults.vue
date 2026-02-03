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
            @click.stop="toggleSettings"
            icon="settings"
            :color="showSettings ? 'primary' : ''"
            round
            dense
            flat
          >
            <hint>{{ $t("Settings") }}</hint>
          </q-btn>
        </q-item-section>
      </template>

      <recess>
        <!-- Settings -->
        <smooth-reflow>
          <div v-if="showSettings" :class="'text-' + textColor">
            <!-- Show Continuation -->
            <q-item
              @click="showContinuationToggle = !showContinuationToggle"
              clickable
              v-ripple
            >
              <q-item-section>
                <q-item-label>{{
                  $t("analysis.showContinuation")
                }}</q-item-label>
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
                  <q-item-label>{{
                    $t("analysis.showFullSuggestion")
                  }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle v-model="showFullPVsToggle" :dark="dark" />
                </q-item-section>
              </q-item>
            </smooth-reflow>
          </div>
        </smooth-reflow>

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
      showSettings: false,
    };
  },
  computed: {
    dark() {
      return this.$store.state.ui.theme.panelDark;
    },
    textColor() {
      return this.dark ? "textLight" : "textDark";
    },
    game() {
      return this.$store.state.game;
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
    showFullPVs() {
      return this.$store.state.analysis.showFullPVs;
    },
    showFullPVsToggle: {
      get() {
        return this.$store.state.analysis.showFullPVs;
      },
      set(value) {
        this.$store.dispatch("analysis/SET", ["showFullPVs", value]);
      },
    },
    showContinuation() {
      return this.$store.state.analysis.showContinuation;
    },
    showContinuationToggle: {
      get() {
        return this.$store.state.analysis.showContinuation;
      },
      set(value) {
        this.$store.dispatch("analysis/SET", ["showContinuation", value]);
      },
    },
  },
  methods: {
    toggleSettings() {
      this.showSettings = !this.showSettings;
      if (this.showSettings) {
        this.sections.savedResults = true;
      }
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
