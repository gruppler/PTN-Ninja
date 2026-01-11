<template>
  <div>
    <q-expansion-item
      v-model="sections.botSuggestions"
      header-class="bg-accent"
      expand-icon-class="fg-inherit"
    >
      <template v-slot:header>
        <q-item-section avatar>
          <q-icon name="bot" />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ $t("analysis.Bot Moves") }}</q-item-label>
        </q-item-section>
        <q-item-section v-if="!sections.botSuggestions && isAnyBotRunning" side>
          <q-spinner-cube size="sm" />
        </q-item-section>
        <q-item-section class="fg-inherit" side>
          <q-btn
            @click.stop="showGlobalSettings = !showGlobalSettings"
            icon="settings"
            :color="showGlobalSettings ? 'primary' : ''"
            round
            dense
            flat
          >
            <hint>{{ $t("Settings") }}</hint>
          </q-btn>
        </q-item-section>
      </template>

      <recess>
        <!-- Global Settings -->
        <smooth-reflow>
          <div v-if="showGlobalSettings">
            <!-- Insert Evaluation Marks -->
            <q-item
              tag="label"
              :class="[
                $store.state.ui.theme.panelDark
                  ? 'text-textLight'
                  : 'text-textDark',
              ]"
              clickable
              v-ripple
            >
              <q-item-section>
                <q-item-label>{{
                  $t("analysis.insertEvalMarks")
                }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="insertEvalMarks"
                  :dark="$store.state.ui.theme.panelDark"
                />
              </q-item-section>
            </q-item>

            <!-- Save Extra Info -->
            <q-item
              tag="label"
              :class="[
                $store.state.ui.theme.panelDark
                  ? 'text-textLight'
                  : 'text-textDark',
              ]"
              clickable
              v-ripple
            >
              <q-item-section>
                <q-item-label>{{
                  $t("analysis.saveSearchStats")
                }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="saveSearchStats"
                  :dark="$store.state.ui.theme.panelDark"
                />
              </q-item-section>
            </q-item>

            <!-- PV Limit -->
            <q-input
              type="number"
              v-model.number="pvLimit"
              :label="$t('analysis.pvLimit')"
              :min="0"
              :max="20"
              item-aligned
              filled
              :dark="$store.state.ui.theme.panelDark"
            />

            <!-- Suggestions to Save -->
            <q-input
              type="number"
              v-model.number="pvsToSave"
              :label="$t('analysis.pvsToSave')"
              :min="1"
              :max="20"
              item-aligned
              filled
              :dark="$store.state.ui.theme.panelDark"
            />
          </div>
        </smooth-reflow>

        <!-- Bot Suggestions -->
        <div
          v-for="(botId, index) in activeBots"
          :key="'bot-' + (botId || index)"
        >
          <q-separator v-if="index > 0" />
          <BotSuggestions
            :bot-id="botId"
            :index="index"
            :is-last-bot="activeBots.length === 1"
            :is-first="index === 0"
            :is-last="index === activeBots.length - 1"
            @select="onBotSelect"
            @remove="onBotRemove"
            @move-up="onBotMoveUp"
            @move-down="onBotMoveDown"
          />
        </div>

        <q-separator />

        <!-- Add Bot Button -->
        <q-btn
          @click="addBot"
          icon="add"
          :label="$t('Add Bot')"
          class="full-width no-border-radius"
          color="primary"
        />

        <q-separator />

        <!-- Saved Results -->
        <q-expansion-item
          v-if="savedSuggestions.length || hasAnalysisNotes"
          v-model="sections.savedResults"
          header-class="bg-ui"
          hide-expand-icon
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
                :disable="!hasAnalysisNotes"
                dense
                round
                flat
              >
                <q-menu
                  transition-show="none"
                  transition-hide="none"
                  auto-close
                  square
                >
                  <q-list>
                    <q-item
                      clickable
                      @click="clearCurrentPositionSavedResults"
                      :disable="!hasCurrentPositionSavedResults"
                    >
                      <q-item-section avatar>
                        <q-icon name="delete" />
                      </q-item-section>
                      <q-item-section>
                        <q-item-label>
                          {{ $t("analysis.Delete Positions Saved Results") }}
                        </q-item-label>
                      </q-item-section>
                    </q-item>

                    <q-item
                      clickable
                      @click="clearSavedResults"
                      :disable="!hasAnalysisNotes"
                    >
                      <q-item-section avatar>
                        <q-icon name="delete_all" />
                      </q-item-section>
                      <q-item-section>
                        <q-item-label>
                          {{ $t("analysis.Delete All Saved Results") }}
                        </q-item-label>
                      </q-item-section>
                    </q-item>
                  </q-list>
                </q-menu>
              </q-btn>
            </q-item-section>
          </template>

          <smooth-reflow>
            <BotAnalysisItem
              v-for="(suggestion, i) in savedSuggestions"
              :key="'saved-' + i"
              :suggestion="suggestion"
              show-bot-name
            />
          </smooth-reflow>
        </q-expansion-item>
      </recess>
    </q-expansion-item>
  </div>
</template>

<script>
import BotSuggestions from "./BotSuggestions.vue";
import BotAnalysisItem from "../analysis/BotAnalysisItem";
import { bots } from "../../bots";
import { cloneDeep } from "lodash";

export default {
  name: "BotAnalysis",
  components: {
    BotSuggestions,
    BotAnalysisItem,
  },
  data() {
    return {
      sections: cloneDeep(this.$store.state.ui.analysisSections),
      showGlobalSettings: false,
    };
  },
  computed: {
    activeBots() {
      return this.$store.state.analysis.activeBots;
    },
    defaultBotID() {
      return this.$store.state.analysis.botID;
    },
    game() {
      return this.$store.state.game;
    },
    tps() {
      return this.game.position.tps;
    },
    allPlies() {
      return this.game.ptn.allPlies;
    },
    isAnyBotRunning() {
      // Check if any active bot is running
      return this.activeBots.some((botId) => {
        if (!botId) return false;
        const bot = bots[botId];
        return bot && bot.state && bot.state.isRunning;
      });
    },
    savedSuggestions() {
      return this.$store.getters["game/suggestions"](this.tps);
    },
    hasAnalysisNotes() {
      return Object.values(this.$store.state.game.comments.notes).some(
        (notes) =>
          notes.some(
            (note) =>
              note.evaluation !== null ||
              note.pv !== null ||
              note.pvAfter !== null
          )
      );
    },
    insertEvalMarks: {
      get() {
        return this.$store.state.analysis.insertEvalMarks;
      },
      set(value) {
        this.$store.dispatch("analysis/SET", ["insertEvalMarks", value]);
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
    pvLimit: {
      get() {
        return this.$store.state.analysis.pvLimit;
      },
      set(value) {
        this.$store.dispatch("analysis/SET", ["pvLimit", value]);
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
    hasCurrentPositionSavedResults() {
      const tps = this.tps;
      const prevPly = this.allPlies.find((p) => p.tpsAfter === tps);
      if (prevPly) {
        const prevNotes = this.$store.state.game.comments.notes[prevPly.id];
        if (prevNotes && prevNotes.some((note) => note.evaluation !== null)) {
          return true;
        }
        if (prevNotes && prevNotes.some((note) => note.pvAfter !== null)) {
          return true;
        }
      }
      const nextPly = this.allPlies.find((p) => p.tpsBefore === tps);
      if (nextPly) {
        const nextNotes = this.$store.state.game.comments.notes[nextPly.id];
        if (nextNotes && nextNotes.some((note) => note.pv !== null)) {
          return true;
        }
      }
      return false;
    },
  },
  methods: {
    addBot() {
      this.$store.dispatch("analysis/ADD_ACTIVE_BOT", null);
    },
    onBotSelect({ index, botId }) {
      this.$store.dispatch("analysis/SET_ACTIVE_BOT", { index, botId });
    },
    onBotRemove(index) {
      const removedBotId = this.activeBots[index];
      this.$store.dispatch("analysis/REMOVE_ACTIVE_BOT", index);
      this.notify({
        icon: "bot_off",
        message: this.$t("Remove Bot"),
        timeout: 5000,
        progress: true,
        actions: [
          {
            label: this.$t("Undo"),
            color: "primary",
            handler: () => {
              this.$store.dispatch("analysis/INSERT_ACTIVE_BOT", {
                index,
                botId: removedBotId,
              });
            },
          },
        ],
      });
    },
    onBotMoveUp(index) {
      if (index > 0) {
        this.$store.dispatch("analysis/REORDER_ACTIVE_BOTS", {
          fromIndex: index,
          toIndex: index - 1,
        });
      }
    },
    onBotMoveDown(index) {
      if (index < this.activeBots.length - 1) {
        this.$store.dispatch("analysis/REORDER_ACTIVE_BOTS", {
          fromIndex: index,
          toIndex: index + 1,
        });
      }
    },
    clearSavedResults() {
      const bot = bots[this.activeBots[0]];
      if (bot) {
        bot.clearSavedResults();
        this.notify({
          icon: "delete_all",
          message: this.$t("analysis.Delete All Saved Results"),
          timeout: 5000,
          progress: true,
          actions: [
            {
              label: this.$t("Undo"),
              color: "primary",
              multiLine: false,
              handler: () => {
                this.$store.dispatch("game/UNDO");
              },
            },
          ],
        });
      }
    },
    clearCurrentPositionSavedResults() {
      if (!this.hasCurrentPositionSavedResults) {
        return;
      }
      this.$store.dispatch("game/REMOVE_POSITION_ANALYSIS_NOTES", this.tps);
      this.notify({
        icon: "delete",
        message: this.$t("analysis.Delete Positions Saved Results"),
        timeout: 5000,
        progress: true,
        multiline: false,
        actions: [
          {
            label: this.$t("Undo"),
            color: "primary",
            handler: () => {
              this.$store.dispatch("game/UNDO");
            },
          },
        ],
      });
    },
  },
  watch: {
    sections: {
      handler(value) {
        this.$store.dispatch("ui/SET_UI", ["analysisSections", value]);
      },
      deep: true,
    },
  },
  mounted() {
    // Initialize with default bot if empty
    if (this.activeBots.length === 0) {
      this.$store.dispatch("analysis/ADD_ACTIVE_BOT", this.defaultBotID);
    }
  },
};
</script>

<style lang="scss">
.interactive-control {
  background-color: $dim;
  body.body--light & {
    background-color: $highlight;
  }
}
</style>
