<template>
  <q-expansion-item
    v-model="expanded"
    :class="['bot-suggestions', { animating }]"
    header-class="bg-accent sticky-header"
    expand-icon-class="fg-inherit"
  >
    <template v-slot:header>
      <!-- Bot selector in header when no bot selected -->
      <template v-if="!botID">
        <q-item-section avatar>
          <q-icon name="add" />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ $t("Select Engine") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-btn
            @click.stop="removeBot"
            icon="close"
            :disable="isLastBot"
            dense
            round
            flat
          >
            <hint>{{ $t("Remove Engine") }}</hint>
          </q-btn>
        </q-item-section>
      </template>

      <!-- Bot info in header when bot is selected -->
      <template v-else>
        <q-item-section avatar>
          <q-btn
            @click.stop="selectActiveBot"
            :color="isActiveBot ? 'primary' : ''"
            :text-color="
              $store.state.ui.theme.accentDark ? 'textLight' : 'textDark'
            "
            style="margin-left: -4px"
            dense
            round
            glossy
          >
            <BotProgress
              v-if="!expanded && botState.isRunning"
              :is-running="botState.isRunning"
              :interactive="botState.isInteractiveEnabled"
              :icon="runningAnalysisIcon"
              :progress="botState.progress"
              class="no-pointer-events"
              no-btn
            />
            <q-icon v-else :name="botOption.icon" />
            <hint>{{ $t("Select Engine Results") }}</hint>
          </q-btn>
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ botOption.label }}</q-item-label>
          <q-item-label
            v-if="botMeta.author && botID !== 'tei'"
            class="fg-inherit"
            caption
          >
            {{ botMeta.author }}
          </q-item-label>
        </q-item-section>
        <q-item-section class="fg-inherit" side>
          <div class="row no-wrap q-gutter-x-sm">
            <q-btn
              @click.stop="toggleBotSettings"
              icon="settings"
              :color="showBotSettings ? 'primary' : ''"
              dense
              round
              flat
            >
              <hint>{{ $t("Settings") }}</hint>
            </q-btn>
            <q-btn @click.stop icon="menu_vertical" dense round flat>
              <q-menu
                transition-show="none"
                transition-hide="none"
                auto-close
                square
              >
                <q-list>
                  <q-item
                    v-if="botOption.isCustom"
                    clickable
                    @click="$router.push({ name: 'bot', params: { botID } })"
                  >
                    <q-item-section avatar>
                      <q-icon name="edit" />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label>{{ $t("Edit") }}</q-item-label>
                    </q-item-section>
                  </q-item>
                  <q-item clickable @click="moveUp" :disable="isFirst">
                    <q-item-section avatar>
                      <q-icon name="up" />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label>{{ $t("Move Up") }}</q-item-label>
                    </q-item-section>
                  </q-item>
                  <q-item clickable @click="moveDown" :disable="isLast">
                    <q-item-section avatar>
                      <q-icon name="down" />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label>{{ $t("Move Down") }}</q-item-label>
                    </q-item-section>
                  </q-item>
                  <q-separator />
                  <q-item clickable @click="removeBot" :disable="isLastBot">
                    <q-item-section avatar>
                      <q-icon name="close" />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label>{{ $t("Remove Engine") }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-btn>
          </div>
        </q-item-section>
      </template>
    </template>

    <!-- Bot Selector (when no bot selected) -->
    <q-select
      v-if="!botID"
      class="bg-ui"
      :value="null"
      :options="availableBots"
      :label="$tc('Engine')"
      behavior="menu"
      transition-show="none"
      transition-hide="none"
      emit-value
      map-options
      item-aligned
      filled
      @input="selectNewBot"
    >
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
    </q-select>

    <!-- Bot Content (when bot is selected) -->
    <template v-if="botID && bot">
      <!-- Settings -->
      <smooth-reflow>
        <div v-if="showBotSettings" class="bg-panel-opaque">
          <!-- TEI Connection Settings -->
          <template v-if="botID === 'tei'">
            <!-- Address -->
            <q-input
              v-model="localBotSettings[botID].address"
              :label="$t('tei.address')"
              :prefix="bot.protocol"
              :dark="dark"
              filled
              :disable="botState.isConnected || botState.isConnecting"
              item-aligned
            >
              <template v-slot:after>
                <!-- Port -->
                <q-input
                  v-model.number="localBotSettings[botID].port"
                  :label="$t('tei.port')"
                  style="width: 9em"
                  type="number"
                  min="0"
                  max="65535"
                  step="1"
                  prefix=":"
                  :dark="dark"
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
              :class="textClass"
              clickable
              v-ripple
            >
              <q-item-section>
                <q-item-label>{{ $t("tei.ssl") }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="localBotSettings[botID].ssl"
                  :dark="dark"
                  :disable="botState.isConnected || botState.isConnecting"
                />
              </q-item-section>
            </q-item>
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
          />

          <!-- Save Bot -->
          <q-btn
            v-if="botID === 'tei'"
            :to="{ name: 'bot-new' }"
            icon="engine"
            :label="$t('tei.Save Engine')"
            :disable="!botState.isConnected"
            class="full-width"
            color="primary"
            stretch
          />

          <!-- Search Limits -->
          <q-separator :dark="dark" />
          <q-item-label :class="textClass" header>{{
            $t("analysis.limit")
          }}</q-item-label>

          <BotLimitInput
            v-for="type in limitTypes"
            :key="type.value"
            v-model.number="localBotSettings[botID][type.value]"
            :label="type.label"
            :type="type.value"
            :min="type.min"
            :max="type.max"
            :step="type.step"
            :disable="
              botState.isRunning ||
              (localBotSettings[botID].limitTypes &&
                !localBotSettings[botID].limitTypes.includes(type.value))
            "
            :dark="dark"
            filled
            item-aligned
          >
            <template v-if="limitTypes.length > 1" v-slot:after>
              <q-toggle
                v-model="localBotSettings[botID].limitTypes"
                :val="type.value"
                :disable="
                  botState.isRunning ||
                  (localBotSettings[botID].limitTypes &&
                    localBotSettings[botID].limitTypes.includes(type.value) &&
                    localBotSettings[botID].limitTypes.length === 1)
                "
              />
            </template>
          </BotLimitInput>
        </div>
      </smooth-reflow>

      <!-- Controls -->
      <div class="relative-position sticky-controls">
        <smooth-reflow>
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
            class="bg-panel-opaque"
          >
            <q-separator :dark="dark" />

            <BotOptionInput
              v-for="(option, name) in botMeta.options"
              :key="name"
              v-model="botOptions[name]"
              :option="option"
              :name="name"
              :disable="botState.isRunning || botState.isInteractiveEnabled"
              @action="bot.sendAction"
              :dark="dark"
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
            <!-- Interactive Analysis -->
            <BotProgress
              v-if="botMeta.isInteractive"
              @click="toggleInteractiveAnalysis"
              :disable="!bot.isInteractiveAvailable"
              icon="int_analysis"
              :hint="$t('analysis.interactiveAnalysis')"
              :is-running="botState.isInteractiveEnabled"
              interactive
              color="primary"
            />
            <!-- Analyze Position -->
            <BotProgress
              @click="analyzePosition()"
              :disable="!bot.isAnalyzePositionAvailable"
              icon="board"
              :hint="$t('analysis.Analyze Position')"
              :is-running="botState.isAnalyzingPosition"
              :progress="botState.progress"
              color="primary"
            />
            <!-- Analyze Branch -->
            <BotProgress
              @click="analyzeBranch()"
              :disable="
                !bot.isAnalyzeGameAvailable && !botState.isAnalyzingBranch
              "
              icon="branch"
              :hint="$t('analysis.Analyze Branch')"
              :is-running="botState.isAnalyzingBranch"
              :progress="botState.progress"
              color="primary"
            />
            <!-- Analyze Game -->
            <BotProgress
              @click="analyzeGame()"
              :disable="
                !bot.isAnalyzeGameAvailable && !botState.isAnalyzingGame
              "
              icon="branches_all"
              :hint="$t('analysis.Analyze Game')"
              :is-running="botState.isAnalyzingGame"
              :progress="botState.progress"
              color="primary"
            />
          </q-btn-group>
        </smooth-reflow>

        <!-- Progress indicators for analysis -->
        <div
          class="shadow-2 row no-wrap justify-end q-pr-md bg-panel-opaque"
          style="height: 36px"
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
              :data-tps-after="botState.analyzingPly.tpsAfter"
              :data-ply-text="botState.analyzingPly.text"
              class="absolute-left q-py-none played-ply-btn"
              no-caps
              dense
              flat
            >
              <Linenum
                :linenum="botState.analyzingPly.linenum"
                no-branch
                :class="textClass"
              />
              <PlyChip
                :ply="botState.analyzingPly"
                class="no-pointer-events q-ma-none"
                no-branches
                no-result
                :done="botState.tps === botState.analyzingPly.tpsAfter"
              />
            </q-btn>
          </div>
          <div v-else-if="nextPlayedPly" class="full-width relative-position">
            <q-btn
              @click.stop="goToNextPlayedPly"
              :data-tps-after="nextPlayedPly.tpsAfter"
              :data-ply-text="nextPlayedPly.text"
              class="absolute-left q-py-none played-ply-btn"
              no-caps
              dense
              flat
            >
              <Linenum
                :linenum="nextPlayedPly.linenum"
                no-branch
                :class="textClass"
              />
              <PlyChip
                :ply="nextPlayedPly"
                class="no-pointer-events q-ma-none"
                no-branches
                no-result
              />
            </q-btn>
          </div>

          <div
            v-if="botState.time !== null || botState.nps !== null"
            class="text-caption text-no-wrap text-right column justify-center q-px-sm"
            :class="textClass"
            style="line-height: 1.1em"
          >
            <div v-if="botState.time !== null">
              {{ $n((botState.time || 0) / 1e3, "n0") }}
              {{ $t("analysis.secondsUnit") }}
            </div>
            <div v-if="botState.nps !== null">
              {{ $n(botState.nps / 1e3 || 0, "n0") }}
              {{ $t("analysis.knps") }}
            </div>
          </div>

          <q-btn
            @click.stop="enableLogging = !enableLogging"
            icon="logs"
            :color="enableLogging ? 'primary' : textColor"
            stretch
            dense
            flat
          >
            <hint>{{ $t("analysis.logMessages") }}</hint>
          </q-btn>
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
                  autoScrollLog
                    ? $t("analysis.logPause")
                    : $t("analysis.logResume")
                }}</hint>
              </q-btn>
              <q-btn @click="clearLog" icon="delete" color="ui">
                <hint>{{ $t("analysis.logClear") }}</hint>
              </q-btn>
            </q-btn-group>
          </recess>
        </q-slide-transition>

        <q-inner-loading
          :showing="
            bot &&
            (botState.isConnected || !botMeta.requiresConnect) &&
            !botState.isTeiOk &&
            !botState.isReady
          "
          :dark="dark"
          :color="textColor"
        />
      </div>

      <!-- Unsaved Results -->
      <div class="results-section">
        <template v-if="displayedSuggestions.length">
          <BotAnalysisItem
            v-for="(suggestion, i) in displayedSuggestions"
            :key="'unsaved-' + i"
            :suggestion="suggestion"
            :prev-suggestion="i > 0 ? displayedSuggestions[i - 1] : null"
            :fixed-height="!showFullPVs"
            :engine-key="suggestionEngineKey"
            :pv-index="i"
            :show-continuation="showContinuation"
            expandable
          />

          <AnalysisItemPlaceholder
            v-for="i in missingSuggestionPlaceholders"
            :key="'placeholder-missing-' + i"
            :show-continuation="showContinuation"
            static
          />
        </template>
        <template v-else>
          <!-- Fill remaining space with placeholders when fewer than average -->
          <template v-if="isAnalyzingGameOrBranch">
            <AnalysisItemPlaceholder
              v-for="i in placeholderCount"
              :key="'placeholder-' + i"
              :show-continuation="showContinuation"
            />
          </template>
          <div v-else class="relative-position">
            <AnalysisItemPlaceholder
              v-for="i in modeResultsCount"
              :key="'static-placeholder-' + i"
              :show-continuation="showContinuation"
              static
            />
            <q-item
              class="flex-center absolute-center full-width"
              :class="textClass"
            >
              {{ $t(isGameEnd ? "analysis.gameOver" : "analysis.noResults") }}
            </q-item>
          </div>
        </template>

        <!-- Bot Action Buttons -->
        <q-btn-group
          :class="textClass"
          class="sticky-actions bg-panel-opaque"
          spread
          stretch
        >
          <q-btn icon="save_move" spread stretch>
            <hint>{{ $t("Save") }}</hint>
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
                    <q-item-label>
                      {{ $t("Save Current Position") }}
                    </q-item-label>
                  </q-item-section>
                </q-item>
                <q-item
                  clickable
                  @click="saveAllResultsToNotes"
                  :disable="!hasResults"
                >
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

          <q-btn icon="delete" spread stretch>
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
                      $t("analysis.Clear Engines Unsaved Results")
                    }}</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </q-btn-group>
      </div>
    </template>
  </q-expansion-item>
</template>

<script>
import BotAnalysisItem from "../analysis/BotAnalysisItem";
import AnalysisItemPlaceholder from "../analysis/AnalysisItemPlaceholder";
import BotLimitInput from "../analysis/BotLimitInput";
import BotOptionInput from "../analysis/BotOptionInput";
import BotProgress from "../analysis/BotProgress";
import Linenum from "../PTN/Linenum.vue";
import PlyChip from "../PTN/Ply.vue";
import { bots } from "../../bots";
import { cloneDeep, isEmpty, isEqual } from "lodash";
import { exportFile } from "quasar";

export default {
  name: "BotSuggestions",
  components: {
    BotAnalysisItem,
    AnalysisItemPlaceholder,
    BotLimitInput,
    BotOptionInput,
    BotProgress,
    Linenum,
    PlyChip,
  },
  props: {
    botId: {
      type: String,
      default: null,
    },
    index: {
      type: Number,
      required: true,
    },
    isLastBot: {
      type: Boolean,
      default: false,
    },
    isFirst: {
      type: Boolean,
      default: false,
    },
    isLast: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      showBotSettings: false,
      localBotSettings: cloneDeep(this.$store.state.analysis.botSettings),
      botOptions: {},
      autoScrollLog: true,
      prevSuggestionsCount: 1,
      animating: false,
    };
  },
  computed: {
    expanded: {
      get() {
        // Default to expanded (true) if not set
        // Use bot name (label) as key for collapsed state
        const key = this.botName != null ? this.botName : "";
        return this.$store.state.analysis.collapsedBots[key] !== true;
      },
      set(value) {
        this.$store.dispatch("analysis/SET_BOT_COLLAPSED", {
          botName: this.botName,
          collapsed: !value,
        });
      },
    },
    dark() {
      return this.$store.state.ui.theme.panelDark;
    },
    textColor() {
      return this.dark ? "textLight" : "textDark";
    },
    textClass() {
      return "text-" + this.textColor;
    },
    botID() {
      return this.botId;
    },
    botList() {
      return this.$store.state.analysis.botList;
    },
    activeBots() {
      return this.$store.state.analysis.activeBots || [];
    },
    availableBots() {
      // Filter out bots that are already added (except the current one)
      return this.botList.filter(
        (b) => !this.activeBots.includes(b.value) || b.value === this.botID
      );
    },
    botOption() {
      return this.botList.find((b) => b.value === this.botID) || {};
    },
    bot() {
      return this.botID ? bots[this.botID] : null;
    },
    botLog() {
      if (!this.botID) return [];
      return this.$store.state.analysis.botLogs[this.botID] || [];
    },
    botMeta() {
      if (!this.botID) return {};
      return this.$store.state.analysis.botMetas[this.botID] || {};
    },
    botState() {
      if (!this.botID) return {};
      return this.$store.state.analysis.botStates[this.botID] || {};
    },
    runningAnalysisIcon() {
      if (!this.botState || this.botState.isInteractiveEnabled) {
        return null;
      }
      if (this.botState.isAnalyzingPosition) {
        return "board";
      }
      if (this.botState.isAnalyzingBranch) {
        return "branch";
      }
      if (this.botState.isAnalyzingGame) {
        return "branches_all";
      }
      return this.botOption.icon || null;
    },
    positions() {
      if (!this.botID) return {};
      return this.$store.state.analysis.botPositions[this.botID] || {};
    },
    game() {
      return this.$store.state.game;
    },
    tps() {
      return this.game.position.tps;
    },
    nextPlayedPly() {
      // Get the next ply that was actually played (after current position)
      const currentPly = this.game.position.ply;
      const branchPlies = this.game.ptn.branchPlies;
      // At starting position (plyIndex 0), return the first ply
      if (
        this.game.position.plyIndex === 0 &&
        !this.game.position.plyIsDone &&
        branchPlies.length > 0
      ) {
        return branchPlies[0];
      }
      if (!currentPly) return null;
      const currentIndex = currentPly.index;
      // Find the next ply in the branch after the current one
      return branchPlies.find((p) => p.index === currentIndex + 1) || null;
    },
    allPlies() {
      return this.game.ptn.allPlies;
    },
    isGameEnd() {
      return (
        this.game.position.isGameEnd && !this.game.position.isGameEndDefault
      );
    },
    hasResults() {
      return !isEmpty(this.positions);
    },
    suggestions() {
      // Return all bot suggestions without filtering duplicates
      return this.positions[this.tps] || [];
    },
    displayedSuggestions() {
      return this.suggestions.slice(0, 8);
    },
    isAnalyzingLive() {
      return (
        this.botState &&
        (this.botState.isAnalyzingPosition ||
          this.botState.isAnalyzingGame ||
          this.botState.isAnalyzingBranch ||
          this.botState.isInteractiveEnabled ||
          this.botState.isRunning)
      );
    },
    configuredMultiPvCount() {
      const optionSources = [
        this.botOptions,
        this.localBotSettings[this.botID]?.options,
        this.$store.state.analysis.botSettings[this.botID]?.options,
        this.bot?.settings?.options,
      ];
      for (const options of optionSources) {
        if (options) {
          for (const [key, value] of Object.entries(options)) {
            if (key.toLowerCase() === "multipv") {
              const numValue = Number(value);
              if (!isNaN(numValue) && numValue > 0) {
                return Math.min(8, Math.max(1, numValue));
              }
            }
          }
        }
      }

      const metaOptionSources = [
        this.$store.state.analysis.customBots[this.botID]?.meta?.presetOptions,
        this.$store.state.analysis.botMetas[this.botID]?.presetOptions,
        this.$store.state.analysis.botMetas[this.botID]?.options,
        this.bot?.meta?.presetOptions,
        this.bot?.meta?.options,
      ];
      for (const options of metaOptionSources) {
        if (options) {
          for (const [key, option] of Object.entries(options)) {
            if (key.toLowerCase() === "multipv") {
              const val = option?.value ?? option?.default;
              const numValue = Number(val);
              if (!isNaN(numValue) && numValue > 0) {
                return Math.min(8, Math.max(1, numValue));
              }
            }
          }
        }
      }

      return null;
    },
    suggestionPlaceholderTargetRows() {
      if (this.configuredMultiPvCount !== null) {
        return this.configuredMultiPvCount;
      }

      return this.modeResultsCount;
    },
    missingSuggestionPlaceholders() {
      if (!this.displayedSuggestions.length) {
        return 0;
      }

      return Math.max(
        0,
        this.suggestionPlaceholderTargetRows - this.displayedSuggestions.length
      );
    },
    placeholderCount() {
      // During branch/game analysis, show placeholders matching previous result count
      if (
        this.botState &&
        (this.botState.isAnalyzingGame || this.botState.isAnalyzingBranch)
      ) {
        const base = Math.max(
          this.prevSuggestionsCount,
          this.configuredMultiPvCount || 1
        );
        return Math.min(8, base);
      }
      return this.configuredMultiPvCount || 1;
    },
    modeResultsCount() {
      // Find the mode (most repeated number) of results across positions with results for this bot
      const positionArrays = Object.values(this.positions).filter(
        (arr) => arr.length > 0
      );
      if (positionArrays.length) {
        const counts = {};
        for (const arr of positionArrays) {
          counts[arr.length] = (counts[arr.length] || 0) + 1;
        }
        let mode = 1;
        let maxFreq = 0;
        for (const [value, freq] of Object.entries(counts)) {
          if (freq > maxFreq) {
            maxFreq = freq;
            mode = parseInt(value, 10);
          }
        }
        return Math.min(8, Math.max(this.configuredMultiPvCount || 1, mode));
      }
      // If no results yet, fallback to configured MultiPV if available
      if (this.configuredMultiPvCount !== null) {
        return this.configuredMultiPvCount;
      }
      return 1;
    },
    isActiveBot() {
      return (
        this.$store.state.analysis.analysisSource === "engines" &&
        this.botID === this.$store.state.analysis.botID &&
        !this.$store.state.analysis.preferSavedResults
      );
    },
    isAnalyzingGameOrBranch() {
      return (
        this.botState &&
        (this.botState.isAnalyzingGame || this.botState.isAnalyzingBranch)
      );
    },
    showFullPVs() {
      return this.$store.state.analysis.showFullPVs;
    },
    showContinuation() {
      return this.$store.state.analysis.showContinuation;
    },
    enableLogging: {
      get() {
        return this.localBotSettings[this.botID]?.enableLogging || false;
      },
      set(value) {
        this.$set(this.localBotSettings[this.botID], "enableLogging", value);
      },
    },
    insertEvalMarks() {
      return this.$store.state.analysis.insertEvalMarks;
    },
    limitTypes() {
      const types = [];
      if (this.bot && this.botMeta.limitTypes) {
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
    botName() {
      return this.botMeta.name || this.bot?.label || null;
    },
    suggestionEngineKey() {
      return this.botName != null ? this.botName : this.botID || "";
    },
  },
  methods: {
    selectNewBot(value) {
      this.$emit("select", { index: this.index, botId: value });
    },
    selectActiveBot() {
      this.$store.dispatch("analysis/SELECT_ENGINE", this.botID);
    },
    removeBot() {
      this.$emit("remove", this.index);
    },
    moveUp() {
      this.$emit("move-up", this.index);
    },
    moveDown() {
      this.$emit("move-down", this.index);
    },
    toggleBotSettings() {
      this.showBotSettings = !this.showBotSettings;
      if (this.showBotSettings) {
        this.expanded = true;
      }
    },
    async setBotOptions() {
      const settings = cloneDeep(this.localBotSettings);
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
      if (this.$refs.botLog && this.localBotSettings[this.botID].log) {
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
      this.notifyUndo({
        icon: "delete_all_outline",
        message: this.$t("success.resultsCleared"),
        handler: () => {
          this.$store.commit("analysis/SET_BOT_POSITIONS", {
            botID: this.botID,
            positions: before,
          });
        },
      });
    },
    clearCurrentPositionResults() {
      if (!this.hasResults || !this.suggestions.length) {
        return;
      }
      const tps = this.tps;
      const before = cloneDeep(this.positions[tps]);
      this.$store.commit("analysis/DELETE_BOT_POSITION", {
        botID: this.botID,
        tps: this.tps,
      });
      this.notifyUndo({
        icon: "delete",
        message: this.$t("success.resultsCleared"),
        handler: () => {
          if (before) {
            this.$store.commit("analysis/SET_BOT_POSITION", {
              botID: this.botID,
              tps,
              suggestions: before,
            });
          }
        },
      });
    },
    goToAnalysisPly() {
      if (this.bot && this.botState.analyzingPly) {
        // Select this bot in the toolbar
        this.bot.selectInToolbar();
        this.$store.dispatch("game/GO_TO_PLY", {
          plyID: this.botState.analyzingPly.id,
          isDone: this.botState.tps === this.botState.analyzingPly.tpsAfter,
        });
      }
    },
    goToNextPlayedPly() {
      if (this.bot && this.nextPlayedPly) {
        // Select this bot in the toolbar
        this.bot.selectInToolbar();
        this.$store.dispatch("game/GO_TO_PLY", {
          plyID: this.nextPlayedPly.id,
          isDone: true,
        });
      }
    },
    analyzePosition() {
      try {
        if (!this.botState.isAnalyzingPosition) {
          this.bot.analyzeCurrentPosition();
        } else {
          this.bot.terminate();
        }
      } catch (error) {}
    },
    analyzeBranch() {
      try {
        if (!this.botState.isAnalyzingBranch) {
          this.bot.analyzeBranch();
        } else {
          this.bot.terminate();
        }
      } catch (error) {}
    },
    analyzeGame() {
      try {
        if (!this.botState.isAnalyzingGame) {
          this.bot.analyzeGame();
        } else {
          this.bot.terminate();
        }
      } catch (error) {}
    },
    toggleInteractiveAnalysis() {
      if (this.bot && this.bot.isInteractiveAvailable) {
        this.bot.isInteractiveEnabled = !this.bot.isInteractiveEnabled;
      }
    },
  },
  mounted() {
    this.$nextTick(() => {
      const header = this.$el.querySelector(".sticky-header");
      if (header) {
        this._headerObserver = new ResizeObserver(() => {
          this.$el.style.setProperty(
            "--header-height",
            header.offsetHeight + "px"
          );
        });
        this._headerObserver.observe(header);
      }
    });
  },
  beforeDestroy() {
    if (this._headerObserver) {
      this._headerObserver.disconnect();
    }
    clearTimeout(this._animTimer);
  },
  watch: {
    expanded() {
      this.animating = true;
      clearTimeout(this._animTimer);
      this._animTimer = setTimeout(() => {
        this.animating = false;
      }, 400);
    },
    botList() {
      this.localBotSettings = cloneDeep(this.$store.state.analysis.botSettings);
    },
    localBotSettings: {
      handler(settings) {
        this.$store.dispatch("analysis/SET", ["botSettings", settings]);
        if (this.botID && settings[this.botID] && settings[this.botID].log) {
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
    bot: {
      handler(newBot) {
        if (newBot) {
          // Merge with existing botOptions to preserve user changes
          this.botOptions = { ...this.botOptions, ...newBot.getOptions() };
        }
      },
      immediate: true,
    },
    botMeta: {
      handler(newMeta) {
        // When bot meta changes (e.g., presetOptions updated), update botOptions
        if (newMeta?.presetOptions) {
          for (const [key, option] of Object.entries(newMeta.presetOptions)) {
            if (option?.value !== undefined) {
              this.$set(this.botOptions, key, option.value);
            }
          }
        }
      },
      deep: true,
      immediate: true,
    },
    suggestions(newSuggestions) {
      // Track previous count for placeholder sizing during analysis
      if (newSuggestions.length > 0) {
        this.prevSuggestionsCount = newSuggestions.length;
      }
    },
  },
};
</script>

<style lang="scss">
.bot-suggestions {
  .sticky-header {
    position: sticky;
    top: 0;
    z-index: 2;
  }
  .sticky-controls {
    position: sticky;
    top: var(--header-height, 48px);
    z-index: 2;
    background-color: var(--q-color-ui);
  }
  &.animating .sticky-controls,
  &.animating .sticky-actions {
    position: relative;
    top: auto;
    bottom: auto;
  }
  .results-section {
    position: relative;
  }
  .sticky-actions {
    position: sticky;
    bottom: 0;
    z-index: 1;
  }
}

.played-ply-btn {
  max-width: 100%;
  overflow: hidden;

  .q-btn__content {
    flex-wrap: nowrap;
    overflow: hidden;
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
</style>
