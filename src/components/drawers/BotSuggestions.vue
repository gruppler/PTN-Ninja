<template>
  <q-expansion-item
    v-model="expanded"
    header-class="bg-ui"
    expand-icon-class="fg-inherit"
    hide-expand-icon
  >
    <template v-slot:header>
      <!-- Bot selector in header when no bot selected -->
      <template v-if="!botID">
        <q-item-section avatar>
          <q-icon name="add" />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ $t("Select Bot") }}</q-item-label>
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
            <hint>{{ $t("Remove Bot") }}</hint>
          </q-btn>
        </q-item-section>
      </template>

      <!-- Bot info in header when bot is selected -->
      <template v-else>
        <q-item-section avatar>
          <q-icon :name="botOption.icon" />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ botOption.label }}</q-item-label>
          <q-item-label class="fg-inherit" caption>
            {{ botMeta.author }}
          </q-item-label>
        </q-item-section>
        <q-item-section v-if="!expanded && botState.isRunning" side>
          <q-spinner-cube size="sm" />
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
                      <q-item-label>{{ $t("Remove Bot") }}</q-item-label>
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
      :label="$t('Select Bot')"
      behavior="menu"
      transition-show="none"
      transition-hide="none"
      emit-value
      map-options
      item-aligned
      filled
      @input="selectBot"
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
        <template v-if="showBotSettings">
          <!-- TEI Connection Settings -->
          <template v-if="botID === 'tei'">
            <q-separator />
            <q-expansion-item
              icon="connect"
              :label="$t('Connection Settings')"
              :default-opened="!botState.isConnected"
            >
              <q-list>
                <!-- Address -->
                <q-input
                  v-model.number="localBotSettings[botID].address"
                  :label="$t('tei.address')"
                  :prefix="bot.protocol"
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
                      v-model="localBotSettings[botID].ssl"
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
          <q-item-label class="fg-inherit" header>{{
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

          <!-- Evaluation Mark Thresholds -->
          <smooth-reflow>
            <template
              v-if="
                insertEvalMarks && localBotSettings[botID].evalMarkThresholds
              "
            >
              <q-item-label class="fg-inherit" header>{{
                $t("analysis.evalMarkThresholds")
              }}</q-item-label>
              <q-input
                type="number"
                v-model.number="
                  localBotSettings[botID].evalMarkThresholds.brilliant
                "
                :label="$t('analysis.thresholds.brilliant')"
                :step="0.01"
                hide-bottom-space
                filled
                item-aligned
              />
              <q-input
                type="number"
                v-model.number="localBotSettings[botID].evalMarkThresholds.good"
                :label="$t('analysis.thresholds.good')"
                :step="0.01"
                hide-bottom-space
                filled
                item-aligned
              />
              <q-input
                type="number"
                v-model.number="localBotSettings[botID].evalMarkThresholds.bad"
                :label="$t('analysis.thresholds.bad')"
                :step="0.01"
                hide-bottom-space
                filled
                item-aligned
              />
              <q-input
                type="number"
                v-model.number="
                  localBotSettings[botID].evalMarkThresholds.blunder
                "
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
            v-if="'normalizeEvaluation' in localBotSettings[botID]"
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
                v-model="localBotSettings[botID].normalizeEvaluation"
              />
            </q-item-section>
          </q-item>

          <smooth-reflow>
            <q-input
              v-if="
                localBotSettings[botID].normalizeEvaluation &&
                'sigma' in localBotSettings[botID]
              "
              type="number"
              v-model.number="localBotSettings[botID].sigma"
              :label="$t('analysis.sigma')"
              :min="1"
              :max="1e4"
              :rules="[(s) => s > 0]"
              hide-bottom-space
              filled
              item-aligned
            />
          </smooth-reflow>
        </template>
      </smooth-reflow>

      <!-- Controls -->
      <div class="relative-position">
        <!-- Connect -->
        <q-btn
          v-if="
            botMeta.requiresConnect && !botState.isConnected && !showBotSettings
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
            (!botMeta.requiresConnect || botState.isConnected) && bot.hasOptions
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
            :indeterminate="botState.isInteractiveEnabled && botState.isRunning"
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
        />
      </div>

      <!-- Unsaved Results -->
      <smooth-reflow>
        <BotAnalysisItem
          v-for="(suggestion, i) in suggestions"
          :key="'unsaved-' + i"
          :suggestion="suggestion"
        />
        <q-item v-if="isGameEnd && !suggestions.length" class="flex-center">
          {{ $t("analysis.gameOver") }}
        </q-item>
      </smooth-reflow>

      <!-- Bot Action Buttons -->
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

        <q-btn icon="delete" spread stretch :disable="!hasResults">
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

              <q-item clickable @click="removeBot" :disable="isLastBot">
                <q-item-section avatar>
                  <q-icon name="close" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ $t("Remove Bot") }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </q-btn-group>
    </template>
  </q-expansion-item>
</template>

<script>
import BotAnalysisItem from "../analysis/BotAnalysisItem";
import BotLimitInput from "../analysis/BotLimitInput";
import BotOptionInput from "../analysis/BotOptionInput";
import Linenum from "../PTN/Linenum.vue";
import PlyChip from "../PTN/Ply.vue";
import { bots } from "../../bots";
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
      expanded: true,
      showBotSettings: false,
      localBotSettings: cloneDeep(this.$store.state.analysis.botSettings),
      botOptions: {},
      autoScrollLog: true,
    };
  },
  computed: {
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
  },
  methods: {
    selectBot(value) {
      this.$emit("select", { index: this.index, botId: value });
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
              this.$store.commit("analysis/SET_BOT_POSITIONS", {
                botID: this.botID,
                positions: before,
              });
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
      this.$store.commit("analysis/DELETE_BOT_POSITION", {
        botID: this.botID,
        tps: this.tps,
      });
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
                this.$store.commit("analysis/SET_BOT_POSITION", {
                  botID: this.botID,
                  tps,
                  suggestions: before,
                });
              }
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
    toggleInteractiveAnalysis() {
      if (this.bot && this.bot.isInteractiveAvailable) {
        this.bot.isInteractiveEnabled = !this.bot.isInteractiveEnabled;
      }
    },
  },
  watch: {
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
          this.botOptions = newBot.getOptions();
        }
      },
      immediate: true,
    },
  },
};
</script>

<style lang="scss">
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
