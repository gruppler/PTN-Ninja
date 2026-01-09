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
        <q-item-section
          v-if="!sections.botSuggestions && botState.isRunning"
          side
        >
          <q-spinner-cube size="sm" />
        </q-item-section>
        <q-item-section class="fg-inherit" side>
          <q-btn
            @click.stop="toggleBotSettings"
            icon="settings"
            :color="showBotSettings ? 'primary' : ''"
            dense
            round
            flat
          />
        </q-item-section>
      </template>

      <!-- Bot -->
      <q-select
        class="bg-ui"
        v-model="botID"
        :options="botList"
        :label="$t('Bot')"
        behavior="menu"
        transition-show="none"
        transition-hide="none"
        emit-value
        map-options
        item-aligned
        filled
      >
        <template v-slot:selected-item="scope">
          <q-item-section class="fg-inherit" side>
            <q-icon :name="scope.opt.icon" class="fg-inherit" />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ scope.opt.label }}</q-item-label>
            <q-item-label class="fg-inherit" caption>{{
              scope.opt.description
            }}</q-item-label>
          </q-item-section>
        </template>
        <template v-slot:option="scope">
          <q-item
            :option="scope.opt"
            :key="scope.opt.value"
            v-bind="scope.itemProps"
            v-on="scope.itemEvents"
          >
            <q-item-section class="fg-inherit" side>
              <q-icon :name="scope.opt.icon" class="fg-inherit" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ scope.opt.label }}</q-item-label>
              <q-item-label class="fg-inherit" caption>{{
                scope.opt.description
              }}</q-item-label>
            </q-item-section>
          </q-item>
        </template>
        <template v-if="botMeta.isCustom" v-slot:append>
          <q-icon
            name="edit"
            class="field__focusable"
            @click.stop.prevent="$router.push({ name: 'bot' })"
          />
        </template>
      </q-select>

      <!-- Settings -->
      <smooth-reflow class="bg-ui">
        <template v-if="showBotSettings">
          <!-- TEI Connection Settings -->
          <template v-if="bot && botID === 'tei'">
            <q-separator />
            <q-expansion-item
              icon="connect"
              :label="$t('Connection Settings')"
              :default-opened="!botState.isConnected"
            >
              <q-list>
                <!-- Address -->
                <q-input
                  v-model.number="botSettings[botID].address"
                  :label="$t('tei.address')"
                  :prefix="bot.protocol"
                  filled
                  :disable="botState.isConnected || botState.isConnecting"
                  item-aligned
                >
                  <template v-slot:after>
                    <!-- Port -->
                    <q-input
                      v-model.number="botSettings[botID].port"
                      :label="$t('tei.port')"
                      style="width: 9em"
                      type="number"
                      min="0"
                      max="65535"
                      step="1"
                      prefix=":"
                      filled
                      clearable
                      :disable="botState.isConnected || botState.isConnecting"
                    />
                  </template>
                </q-input>

                <!-- Use SSL -->
                <q-item
                  tag="label"
                  :disable="botState.isConnected || botState.isConnecting"
                  clickable
                  v-ripple
                >
                  <q-item-section>
                    <q-item-label>{{ $t("tei.ssl") }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-toggle
                      v-model="botSettings[botID].ssl"
                      :disable="botState.isConnected || botState.isConnecting"
                    />
                  </q-item-section>
                </q-item>
              </q-list>
            </q-expansion-item>
          </template>

          <!-- Connect -->
          <q-btn
            v-if="botMeta.requiresConnect && !botState.isConnected"
            @click="bot.connect()"
            :loading="botState.isConnecting"
            icon="connect"
            :label="$t('tei.connect')"
            class="full-width"
            color="primary"
            stretch
          />

          <!-- Disconnect -->
          <q-btn
            v-if="botMeta.requiresConnect && botState.isConnected"
            @click="bot.disconnect()"
            icon="disconnect"
            :label="$t('tei.disconnect')"
            class="full-width"
            color="primary"
            stretch
            flat
          />

          <!-- Save Bot -->
          <q-btn
            v-if="botID === 'tei'"
            :to="{ name: 'bot' }"
            icon="bot"
            :label="$t('tei.Save Bot')"
            :disable="!botState.isConnected"
            class="full-width"
            color="primary"
            stretch
            flat
          />

          <!-- Search Limits -->
          <q-separator />
          <q-item-label header>{{ $t("analysis.limit") }}</q-item-label>

          <BotLimitInput
            v-for="type in limitTypes"
            :key="type.value"
            v-model.number="botSettings[botID][type.value]"
            :label="type.label"
            :type="type.value"
            :min="type.min"
            :max="type.max"
            :step="type.step"
            :disable="
              botState.isRunning ||
              (botSettings[botID].limitTypes &&
                !botSettings[botID].limitTypes.includes(type.value))
            "
            filled
            item-aligned
          >
            <template v-if="limitTypes.length > 1" v-slot:after>
              <q-toggle
                v-model="botSettings[botID].limitTypes"
                :val="type.value"
                :disable="
                  botState.isRunning ||
                  (botSettings[botID].limitTypes &&
                    botSettings[botID].limitTypes.includes(type.value) &&
                    botSettings[botID].limitTypes.length === 1)
                "
              />
            </template>
          </BotLimitInput>

          <q-separator />

          <!-- Log messages -->
          <q-item tag="label" clickable v-ripple>
            <q-item-section>
              <q-item-label>{{ $t("analysis.logMessages") }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-toggle key="enableLogging" v-model="enableLogging" />
            </q-item-section>
          </q-item>

          <!-- Insert Evaluation Marks -->
          <q-item tag="label" clickable v-ripple>
            <q-item-section>
              <q-item-label>{{ $t("analysis.insertEvalMarks") }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-toggle key="insertEvalMarks" v-model="insertEvalMarks" />
            </q-item-section>
          </q-item>

          <!-- Evaluation Mark Thresholds -->
          <smooth-reflow>
            <template
              v-if="insertEvalMarks && botSettings[botID].evalMarkThresholds"
            >
              <q-item-label header>{{
                $t("analysis.evalMarkThresholds")
              }}</q-item-label>
              <q-input
                type="number"
                v-model.number="botSettings[botID].evalMarkThresholds.brilliant"
                :label="$t('analysis.thresholds.brilliant')"
                :step="0.01"
                hide-bottom-space
                filled
                item-aligned
              />
              <q-input
                type="number"
                v-model.number="botSettings[botID].evalMarkThresholds.good"
                :label="$t('analysis.thresholds.good')"
                :step="0.01"
                hide-bottom-space
                filled
                item-aligned
              />
              <q-input
                type="number"
                v-model.number="botSettings[botID].evalMarkThresholds.bad"
                :label="$t('analysis.thresholds.bad')"
                :step="0.01"
                hide-bottom-space
                filled
                item-aligned
              />
              <q-input
                type="number"
                v-model.number="botSettings[botID].evalMarkThresholds.blunder"
                :label="$t('analysis.thresholds.blunder')"
                :step="0.01"
                hide-bottom-space
                filled
                item-aligned
              />
            </template>
          </smooth-reflow>

          <!-- Normalize Evaluation -->
          <q-item
            v-if="'normalizeEvaluation' in botSettings[botID]"
            tag="label"
            clickable
            v-ripple
          >
            <q-item-section>
              <q-item-label>{{
                $t("analysis.normalizeEvaluation")
              }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-toggle
                key="botSettings"
                v-model="botSettings[botID].normalizeEvaluation"
              />
            </q-item-section>
          </q-item>

          <smooth-reflow>
            <q-input
              v-if="
                botSettings[botID].normalizeEvaluation &&
                'sigma' in botSettings[botID]
              "
              type="number"
              v-model.number="botSettings[botID].sigma"
              :label="$t('analysis.sigma')"
              :min="1"
              :max="1e4"
              :rules="[(s) => s > 0]"
              hide-bottom-space
              filled
              item-aligned
            />
          </smooth-reflow>

          <!-- Save Extra Info -->
          <q-item tag="label" clickable v-ripple>
            <q-item-section>
              <q-item-label>{{ $t("analysis.saveSearchStats") }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-toggle key="saveSearchStats" v-model="saveSearchStats" />
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
          />

          <!-- Tiltak Cloud -->
          <!-- Max Suggestions -->
          <q-input
            v-if="botID === 'tiltak-cloud'"
            v-model.number="botSettings[botID].maxSuggestedMoves"
            :label="$t('analysis.maxSuggestedMoves')"
            type="number"
            min="1"
            max="20"
            step="1"
            item-aligned
            filled
          />
        </template>
      </smooth-reflow>

      <!-- Controls -->
      <div class="relative-position">
        <template v-if="bot">
          <!-- Connect -->
          <q-btn
            v-if="
              botMeta.requiresConnect &&
              !botState.isConnected &&
              !showBotSettings
            "
            @click="bot.connect()"
            :loading="botState.isConnecting"
            icon="connect"
            :label="$t('tei.connect')"
            class="full-width"
            color="primary"
            stretch
          />

          <!-- Other Bot Options -->
          <div
            v-if="
              (!botMeta.requiresConnect || botState.isConnected) &&
              bot.hasOptions
            "
            class="bg-ui"
          >
            <q-separator />

            <BotOptionInput
              v-for="(option, name) in botMeta.options"
              :key="name"
              v-model="botOptions[name]"
              :option="option"
              :name="name"
              :disable="botState.isRunning || botState.isInteractiveEnabled"
              @action="bot.sendAction"
              filled
              item-aligned
            />

            <q-btn
              @click="setBotOptions"
              icon="apply"
              :label="$t('analysis.Apply Options')"
              :loading="botState.isReadying"
              class="full-width"
              color="primary"
              :flat="areBotOptionsApplied && botState.isReady"
              stretch
            />
          </div>

          <!-- Analysis Controls -->
          <q-btn-group
            v-if="!botMeta.requiresConnect || botState.isConnected"
            spread
            stretch
            class="analysis-controls-group"
          >
            <!-- Analyze Position -->
            <q-btn
              @click="analyzePosition()"
              :loading="botState.isAnalyzingPosition"
              :disable="!bot.isAnalyzePositionAvailable"
              color="primary"
              icon="board"
            >
              <hint>{{ $t("analysis.Analyze Position") }}</hint>
            </q-btn>
            <!-- Analyze Branch -->
            <q-btn
              @click="bot.analyzeBranch()"
              :loading="botState.isAnalyzingBranch"
              :disable="!bot.isAnalyzeGameAvailable"
              color="primary"
              icon="branch"
            >
              <hint>{{ $t("analysis.Analyze Branch") }}</hint>
            </q-btn>
            <!-- Analyze Game -->
            <q-btn
              @click="bot.analyzeGame()"
              :loading="botState.isAnalyzingGame"
              :disable="!bot.isAnalyzeGameAvailable"
              color="primary"
              icon="branches_all"
            >
              <hint>{{ $t("analysis.Analyze Game") }}</hint>
            </q-btn>
            <!-- Interactive Analysis -->
            <q-btn
              v-if="botMeta.isInteractive"
              @click="toggleInteractiveAnalysis"
              color="primary"
              :disable="!bot.isInteractiveAvailable"
            >
              <q-spinner-cube
                v-if="botState.isInteractiveEnabled && botState.isRunning"
                size="sm"
                class="q-ml-xs"
              />
              <q-icon v-else name="int_analysis" />
              <hint>{{ $t("analysis.interactiveAnalysis") }}</hint>
            </q-btn>
          </q-btn-group>

          <!-- Live Stats -->
          <div class="bg-ui relative-position" style="height: 36px">
            <div class="text-caption text-center q-pa-sm">
              <template v-if="botState.time !== null || botState.nps !== null">
                <span v-if="botState.time !== null">
                  {{ $n((botState.time || 0) / 1e3, "n0") }}
                  {{ $t("analysis.secondsUnit") }}
                </span>
                <span v-if="botState.time !== null && botState.nps !== null">
                  •
                </span>
                <span v-if="botState.nps !== null">
                  {{ $n(botState.nps / 1e3 || 0, "n0") }}
                  {{ $t("analysis.knps") }}
                </span>
              </template>
              <span v-else>
                {{ $t("analysis.notRunning") }}
              </span>
            </div>

            <!-- Progress indicators for analysis -->
            <div
              class="absolute-top full-width full-height row no-wrap justify-end"
            >
              <div
                v-if="
                  botState.isAnalyzingPosition ||
                  botState.isAnalyzingGame ||
                  botState.isAnalyzingBranch
                "
                class="full-width relative-position"
              >
                <q-btn
                  v-if="botState.analyzingPly"
                  @click.stop="goToAnalysisPly"
                  class="absolute-left q-py-none"
                  :class="{
                    highlight: $store.state.ui.theme.primaryDark,
                    dim: !$store.state.ui.theme.primaryDark,
                  }"
                  no-caps
                  dense
                  flat
                >
                  <Linenum :linenum="botState.analyzingPly.linenum" no-branch />
                  <PlyChip
                    :ply="botState.analyzingPly"
                    class="no-pointer-events q-ma-none"
                    no-branches
                    :done="botState.tps === botState.analyzingPly.tpsAfter"
                  />
                </q-btn>
                <q-btn
                  :label="$t('Cancel')"
                  @click.stop="bot.terminate()"
                  color="primary"
                  class="absolute-right"
                  stretch
                  flat
                />
              </div>

              <q-btn
                @click.stop="enableLogging = !enableLogging"
                icon="logs"
                :color="enableLogging ? 'primary' : ''"
                stretch
                dense
                flat
              >
                <hint>{{ $t("analysis.logMessages") }}</hint>
              </q-btn>
            </div>

            <q-linear-progress
              v-if="botState && botState.isRunning"
              class="absolute-position"
              style="bottom: 0; z-index: 1"
              size="2px"
              :value="botState.progress / 100"
              :indeterminate="
                botState.isInteractiveEnabled && botState.isRunning
              "
            />
          </div>

          <!-- Log -->
          <q-slide-transition>
            <recess v-if="enableLogging">
              <q-virtual-scroll
                ref="botLog"
                class="bot-log text-selectable bg-ui q-px-sm"
                :items="botLog"
                :virtual-scroll-item-size="16.8"
                :virtual-scroll-slice-ratio-before="0.5"
                :virtual-scroll-slice-ratio-after="0.5"
              >
                <template v-slot="{ item }">
                  <div
                    class="log-message"
                    :class="{ sent: !item.received, received: item.received }"
                  >
                    {{ item.message }}
                  </div>
                </template>
              </q-virtual-scroll>
              <q-btn-group spread stretch>
                <q-btn @click="saveLog" icon="save" color="ui">
                  <hint>{{ $t("analysis.logSave") }}</hint>
                </q-btn>
                <q-btn
                  @click="toggleLogScroll"
                  :icon="autoScrollLog ? 'pause' : 'play'"
                  color="ui"
                >
                  <hint>{{
                    $t(
                      autoScrollLog ? "analysis.logPause" : "analysis.logResume"
                    )
                  }}</hint>
                </q-btn>
                <q-btn @click="clearLog" icon="delete" color="ui">
                  <hint>{{ $t("analysis.logClear") }}</hint>
                </q-btn>
              </q-btn-group>
            </recess>
          </q-slide-transition>
        </template>

        <q-inner-loading
          :showing="
            bot &&
            (botState.isConnected || !botMeta.requiresConnect) &&
            !botState.isTeiOk &&
            !botState.isReady
          "
        />
      </div>

      <!-- Results -->
      <smooth-reflow>
        <BotAnalysisItem
          v-for="(suggestion, i) in suggestions.slice(
            0,
            botSettings[botID].maxSuggestedMoves
          )"
          :key="i"
          :suggestion="suggestion"
        />
        <q-item v-if="isGameEnd" class="flex-center">
          {{ $t("analysis.gameOver") }}
        </q-item>
      </smooth-reflow>

      <q-separator v-if="!suggestions.length" />

      <!-- Action Buttons -->
      <q-btn-group class="bg-ui" spread stretch>
        <q-btn icon="save" spread stretch :disable="!hasResults">
          <hint>{{ $t("Save to Notes") }}</hint>
          <q-menu
            transition-show="none"
            transition-hide="none"
            auto-close
            square
          >
            <q-list>
              <q-item
                clickable
                @click="saveCurrentPositionToNotes"
                :disable="!suggestions.length"
              >
                <q-item-section avatar>
                  <q-icon name="save" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ $t("Save Current Position") }}</q-item-label>
                </q-item-section>
              </q-item>
              <q-item clickable @click="saveAllResultsToNotes">
                <q-item-section avatar>
                  <q-icon name="save_all" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ $t("Save All") }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>

        <q-btn
          icon="delete"
          spread
          stretch
          :disable="!hasResults && !hasAnalysisNotes"
        >
          <hint>{{ $t("Delete") }}</hint>
          <q-menu
            transition-show="none"
            transition-hide="none"
            auto-close
            square
          >
            <q-list>
              <q-item
                clickable
                @click="clearCurrentPositionResults"
                :disable="!suggestions.length"
              >
                <q-item-section avatar>
                  <q-icon name="delete_outline" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>
                    {{ $t("analysis.Clear Positions Unsaved Results") }}
                  </q-item-label>
                </q-item-section>
              </q-item>

              <q-item
                clickable
                @click="clearUnsavedResults"
                :disable="!hasResults"
              >
                <q-item-section avatar>
                  <q-icon name="delete_all_outline" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{
                    $t("analysis.Clear All Unsaved Results")
                  }}</q-item-label>
                </q-item-section>
              </q-item>

              <q-separator />

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
      </q-btn-group>
    </q-expansion-item>
  </div>
</template>

<script>
import BotAnalysisItem from "../analysis/BotAnalysisItem";
import BotLimitInput from "../analysis/BotLimitInput";
import BotOptionInput from "../analysis/BotOptionInput";
import Linenum from "../PTN/Linenum.vue";
import PlyChip from "../PTN/Ply.vue";
import { cloneDeep, isEmpty, isEqual } from "lodash";
import { exportFile } from "quasar";

export default {
  name: "BotSuggestions",
  components: {
    BotAnalysisItem,
    BotLimitInput,
    BotOptionInput,
    Linenum,
    PlyChip,
  },
  data() {
    return {
      showBotSettings: false,
      botSettings: cloneDeep(this.$store.state.analysis.botSettings),
      botOptions: this.bot ? this.bot.getOptions() : {},
      autoScrollLog: true,
      sections: cloneDeep(this.$store.state.ui.analysisSections),
    };
  },
  computed: {
    isOffline() {
      return this.$store.state.ui.offline;
    },
    isPanelVisible() {
      return (
        this.$store.state.ui.showText &&
        this.$store.state.ui.textTab === "analysis"
      );
    },
    showAllBranches() {
      return this.$store.state.ui.showAllBranches;
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
    plies() {
      return this.game.ptn[[this.showAllBranches ? "allPlies" : "branchPlies"]];
    },
    isGameEnd() {
      return (
        this.game.position.isGameEnd && !this.game.position.isGameEndDefault
      );
    },
    botID: {
      get() {
        return this.$store.state.analysis.botID;
      },
      set(value) {
        this.$store.dispatch("analysis/SET", ["botID", value]);
      },
    },
    botList() {
      return this.$store.state.analysis.botList;
    },
    bot() {
      return this.$store.getters["analysis/bot"];
    },
    botLog() {
      return this.$store.state.analysis.botLog;
    },
    botMeta() {
      return this.$store.state.analysis.botMeta;
    },
    botState() {
      return this.$store.state.analysis.botState;
    },
    positions() {
      return this.$store.state.analysis.botPositions;
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
    hasCurrentPositionSavedResults() {
      const tps = this.tps;
      // Check previous ply for evaluation
      const prevPly = this.allPlies.find((p) => p.tpsAfter === tps);
      if (prevPly) {
        const prevNotes = this.$store.state.game.comments.notes[prevPly.id];
        if (prevNotes && prevNotes.some((note) => note.evaluation !== null)) {
          return true;
        }
      }
      // Check previous ply for pvAfter (new format)
      if (prevPly) {
        const prevNotes = this.$store.state.game.comments.notes[prevPly.id];
        if (prevNotes && prevNotes.some((note) => note.pvAfter !== null)) {
          return true;
        }
      }
      // Check next ply for PV (old format)
      const nextPly = this.allPlies.find((p) => p.tpsBefore === tps);
      if (nextPly) {
        const nextNotes = this.$store.state.game.comments.notes[nextPly.id];
        if (nextNotes && nextNotes.some((note) => note.pv !== null)) {
          return true;
        }
      }
      return false;
    },
    hasResults() {
      return !isEmpty(this.positions);
    },
    suggestions() {
      const botSuggestions = this.positions[this.tps] || [];
      const noteSuggestions = this.$store.getters["game/suggestions"](this.tps);

      // Merge bot suggestions with note suggestions, avoiding duplicates
      // Bot suggestions take priority (they have more recent/detailed data)
      const merged = [...botSuggestions];
      for (const noteSugg of noteSuggestions) {
        // Check if this PV already exists in bot suggestions
        const isDuplicate = merged.some(
          (s) => s.ply && noteSugg.ply && s.ply.ptn === noteSugg.ply.ptn
        );
        if (!isDuplicate) {
          merged.push(noteSugg);
        }
      }
      return merged;
    },
    enableLogging: {
      get() {
        return this.$store.state.analysis.enableLogging;
      },
      set(value) {
        this.$store.dispatch("analysis/SET", ["enableLogging", value]);
      },
    },
    insertEvalMarks: {
      get() {
        return this.$store.state.analysis.insertEvalMarks;
      },
      set(value) {
        this.$store.dispatch("analysis/SET", ["insertEvalMarks", value]);
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
    saveSearchStats: {
      get() {
        return this.$store.state.analysis.saveSearchStats;
      },
      set(value) {
        this.$store.dispatch("analysis/SET", ["saveSearchStats", value]);
      },
    },
    limitTypes() {
      const types = [];
      if (this.bot) {
        if ("depth" in this.botMeta.limitTypes) {
          types.push({
            label: this.$t("analysis.Depth"),
            value: "depth",
            ...this.botMeta.limitTypes.depth,
          });
        }
        if ("nodes" in this.botMeta.limitTypes) {
          types.push({
            label: this.$t("analysis.Nodes"),
            value: "nodes",
            ...this.botMeta.limitTypes.nodes,
          });
        }
        if ("movetime" in this.botMeta.limitTypes) {
          types.push({
            label: this.$t("analysis.movetime"),
            value: "movetime",
            ...this.botMeta.limitTypes.movetime,
          });
        }
      }
      return types;
    },
    areBotOptionsApplied() {
      return this.bot && isEqual(this.botOptions, this.bot.getOptions());
    },
  },
  methods: {
    toggleBotSettings() {
      this.showBotSettings = !this.showBotSettings;
      // Expand panel with settings if the panel was collapsed
      if (this.showBotSettings) {
        this.sections.botSuggestions = true;
      }
    },
    async setBotOptions() {
      const settings = cloneDeep(this.botSettings);
      settings[this.botID].options = Object.assign(
        settings[this.botID].options || {},
        this.botOptions
      );
      await this.$store.dispatch("analysis/SET", ["botSettings", settings]);
      this.bot.applyOptions();
    },
    saveLog() {
      const file = new File(
        [
          this.botLog
            .map((l) => `${l.received ? "<<" : ">>"} ${l.message}`)
            .join("\n"),
        ],
        `${this.bot.label}_${new Date().toISOString()}.txt`,
        {
          type: "text/plain",
        }
      );
      exportFile(file.name, file);
    },
    scrollLog() {
      if (this.$refs.botLog && this.botSettings[this.botID].log) {
        this.$refs.botLog.scrollTo(this.botLog.length, "end-force");
      }
    },
    toggleLogScroll() {
      if ((this.autoScrollLog = !this.autoScrollLog)) {
        this.scrollLog();
      }
    },
    clearLog() {
      this.bot.clearLog();
      this.autoScrollLog = true;
    },
    saveAllResultsToNotes() {
      this.bot.saveEvalComments();
    },
    saveCurrentPositionToNotes() {
      if (!this.bot) {
        return;
      }
      this.bot.saveEvalComments(this.tps);
    },
    clearUnsavedResults() {
      if (!this.hasResults) {
        return;
      }
      const before = cloneDeep(this.positions);
      this.bot.clearResults();
      this.notify({
        icon: "delete_all_outline",
        message: this.$t("analysis.Clear All Unsaved Results"),
        timeout: 5000,
        progress: true,
        multiLine: false,
        actions: [
          {
            label: this.$t("Undo"),
            color: "primary",
            handler: () => {
              this.$store.commit("analysis/SET_BOT_POSITIONS", before);
            },
          },
        ],
      });
    },
    clearCurrentPositionResults() {
      if (!this.hasResults || !this.suggestions.length) {
        return;
      }
      const tps = this.tps;
      const before = cloneDeep(this.positions[tps]);
      this.$store.commit("analysis/DELETE_BOT_POSITION", this.tps);
      this.notify({
        icon: "delete",
        message: this.$t("analysis.Clear Positions Unsaved Results"),
        timeout: 5000,
        progress: true,
        multiline: false,
        actions: [
          {
            label: this.$t("Undo"),
            color: "primary",
            handler: () => {
              if (before) {
                this.$store.commit("analysis/SET_BOT_POSITION", [tps, before]);
              }
            },
          },
        ],
      });
    },
    clearSavedResults() {
      if (!this.hasResults) {
        return;
      }
      this.bot.clearSavedResults();
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
    goToAnalysisPly() {
      if (this.bot && this.botState.analyzingPly) {
        this.$store.dispatch("game/GO_TO_PLY", {
          plyID: this.botState.analyzingPly.id,
          isDone: this.botState.tps === this.botState.analyzingPly.tpsAfter,
        });
      }
    },
    analyzePosition() {
      try {
        if (!this.botState.isAnalyzingPosition) {
          this.bot.analyzeCurrentPosition();
        }
      } catch (error) {}
    },
    analyzeGame() {
      try {
        this.bot.analyzeGame();
      } catch (error) {}
    },
    toggleInteractiveAnalysis() {
      if (this.bot && this.bot.isInteractiveAvailable) {
        this.bot.isInteractiveEnabled = !this.bot.isInteractiveEnabled;
      }
    },
  },

  watch: {
    sections: {
      handler(value) {
        this.$store.dispatch("ui/SET_UI", ["analysisSections", value]);
      },
      deep: true,
    },
    bot(newBot, oldBot) {
      if (oldBot && oldBot.id !== newBot.id) {
        // Stop interactive analysis when switching bots
        if (oldBot.meta.isInteractive && oldBot.isInteractiveEnabled) {
          oldBot.isInteractiveEnabled = false;
        }
      }
    },
    botList() {
      this.botSettings = cloneDeep(this.$store.state.analysis.botSettings);
    },
    botSettings: {
      handler(settings) {
        this.$store.dispatch("analysis/SET", ["botSettings", settings]);
        if (settings[this.botID].log) {
          this.scrollLog();
        }
      },
      deep: true,
    },
    botLog(log) {
      if (this.$refs.botLog) {
        this.$refs.botLog.refresh(
          this.autoScrollLog ? log.length - 1 : undefined
        );
      }
    },
    "botMeta.options": {
      handler() {
        this.botOptions = this.bot.getOptions();
      },
      deep: true,
    },
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

.bot-log {
  font-family: "Source Code Pro";
  font-size: 0.8em;
  min-height: 10em;
  height: 20vh;
  overflow-x: hidden;
  overflow-y: scroll;
  direction: rtl;

  .log-message {
    direction: ltr;
    position: relative;
    padding-left: 2em;
    word-break: break-all;

    &.sent::before {
      content: ">> ";
      position: absolute;
      left: 0;
    }
    &.received::before {
      content: "<< ";
      position: absolute;
      left: 0;
    }
  }
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
