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
          <q-item-label v-if="botID" class="fg-inherit" caption>
            <template v-if="botMeta.name">
              <span class="text-bold">{{ botMeta.name }}</span>
              <template v-if="botMeta.version">
                {{ botMeta.version }}
              </template>
              <template v-if="botMeta.author">
                {{ $t("tei.by") }} {{ botMeta.author }}
              </template>
            </template>
            <template v-else>
              {{ $t(`analysis.bots.${botID}`) }}
            </template>
          </q-item-label>
        </q-item-section>
        <q-item-section
          v-if="!sections.botSuggestions && botState.isRunning"
          side
        >
          <q-spinner size="sm" />
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

      <!-- Settings -->
      <smooth-reflow class="bg-ui">
        <template v-if="showBotSettings">
          <!-- Bot -->
          <q-select
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

          <q-separator />

          <!-- Log messages -->
          <q-item
            v-if="'log' in botSettings[botID]"
            tag="label"
            clickable
            v-ripple
          >
            <q-item-section>
              <q-item-label>{{ $t("analysis.logMessages") }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-toggle v-model="botSettings[botID].log" />
            </q-item-section>
          </q-item>

          <!-- Insert Evaluation Marks -->
          <q-item tag="label" clickable v-ripple>
            <q-item-section>
              <q-item-label>{{ $t("analysis.insertEvalMarks") }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-toggle v-model="botSettings[botID].insertEvalMarks" />
            </q-item-section>
          </q-item>

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
              <q-toggle v-model="botSettings[botID].normalizeEvaluation" />
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

            <!-- Save Bot -->
            <q-btn
              v-if="botState.isConnected"
              :to="{ name: 'bot' }"
              icon="bot"
              :label="$t('tei.Save Bot')"
              class="full-width"
              color="primary"
              stretch
              flat
            />
          </template>
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
        </template>
      </smooth-reflow>

      <!-- Controls -->
      <smooth-reflow class="relative-position">
        <template v-if="bot">
          <smooth-reflow>
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

            <!-- Other Bot Options -->
            <div v-else-if="bot.hasOptions" class="bg-ui">
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
          </smooth-reflow>

          <!-- Analyze Full-Game/Branch -->
          <div class="relative-position">
            <q-btn
              @click="bot.analyzeGame()"
              :loading="botState.isAnalyzingGame"
              :percentage="botState.progress"
              :disable="!bot.isAnalyzeGameAvailable"
              class="full-width"
              color="primary"
              stretch
            >
              <q-icon
                :name="showAllBranches ? 'moves' : 'branch'"
                :class="{ 'rotate-180': !showAllBranches }"
                left
              />
              {{
                $t(
                  showAllBranches
                    ? "analysis.Analyze Game"
                    : "analysis.Analyze Branch"
                )
              }}
            </q-btn>
            <span
              v-if="botState.isAnalyzingGame && botState.analyzingPly"
              @click.stop="goToAnalysisPly"
              class="absolute-left q-pl-sm cursor-pointer"
              :class="{
                highlight: $store.state.ui.theme.primaryDark,
                dim: !$store.state.ui.theme.primaryDark,
              }"
            >
              <Linenum :linenum="botState.analyzingPly.linenum" no-branch />
              <PlyChip
                :ply="botState.analyzingPly"
                no-branches
                :done="botState.tps === botState.analyzingPly.tpsAfter"
              />
            </span>
            <q-btn
              v-if="botState.isAnalyzingGame"
              :label="$t('Cancel')"
              @click.stop="bot.terminate()"
              class="absolute-right"
              :text-color="
                $store.state.ui.theme.primaryDark ? 'textLight' : 'textDark'
              "
              stretch
              flat
            />
          </div>

          <!-- Analyze Position -->
          <div class="relative-position">
            <q-btn
              @click="
                botState.isAnalyzingPosition
                  ? null
                  : bot.analyzeCurrentPosition()
              "
              :loading="botState.isAnalyzingPosition"
              :percentage="botState.progress"
              :disable="!bot.isAnalyzePositionAvailable"
              class="full-width"
              color="primary"
              icon="board"
              :label="$t('analysis.Analyze Position')"
              stretch
            />
            <span
              v-if="botState.isAnalyzingPosition && botState.analyzingPly"
              @click.stop="goToAnalysisPly"
              class="absolute-left q-pl-sm cursor-pointer"
              :class="{
                highlight: $store.state.ui.theme.primaryDark,
                dim: !$store.state.ui.theme.primaryDark,
              }"
            >
              <Linenum :linenum="botState.analyzingPly.linenum" no-branch />
              <PlyChip
                :ply="botState.analyzingPly"
                no-branches
                :done="botState.tps === botState.analyzingPly.tpsAfter"
              />
            </span>
            <q-btn
              v-if="botState.isAnalyzingPosition"
              :label="$t('Cancel')"
              @click.stop="bot.terminate()"
              class="absolute-right"
              :text-color="
                $store.state.ui.theme.primaryDark ? 'textLight' : 'textDark'
              "
              stretch
              flat
            />
          </div>

          <smooth-reflow>
            <!-- Interactive Analysis -->
            <q-item
              v-if="botMeta.isInteractive"
              class="interactive-control"
              tag="label"
              :disabled="!bot.isInteractiveAvailable"
              :clickable="bot.isInteractiveAvailable"
              v-ripple="bot.isInteractiveAvailable"
            >
              <q-item-section avatar>
                <q-spinner
                  v-if="botState.isInteractiveEnabled && botState.isRunning"
                  size="sm"
                />
                <q-icon v-else name="int_analysis" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{
                  $t("analysis.interactiveAnalysis")
                }}</q-item-label>
              </q-item-section>
              <q-item-section
                v-if="botState.time !== null || botState.nps !== null"
                side
              >
                <div v-if="botState.time !== null" class="text-caption">
                  {{ $n((botState.time || 0) / 1e3, "n0") }}
                  {{ $t("analysis.secondsUnit") }}
                </div>
                <div v-if="botState.nps !== null" class="text-caption">
                  {{ $n(botState.nps || 0, "n0") }}
                  {{ $t("analysis.nps") }}
                </div>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="bot.isInteractiveEnabled"
                  :disable="!bot.isInteractiveAvailable"
                />
              </q-item-section>
            </q-item>

            <recess v-if="botSettings[botID].log">
              <div
                ref="botLog"
                class="bot-log text-selectable bg-ui q-pa-sm"
                @scroll="handleLogScroll"
              >
                <div
                  v-for="(log, i) in botLog"
                  :key="i"
                  :class="{ sent: !log.received, received: log.received }"
                >
                  {{ log.message }}
                </div>
              </div>
              <q-btn-group spread stretch>
                <q-btn @click="clearLog()" icon="delete" color="ui" />
                <q-btn
                  @click="
                    autoScrollLog = true;
                    scrollLog();
                  "
                  icon="to_bottom"
                  color="ui"
                />
              </q-btn-group>
            </recess>
          </smooth-reflow>
        </template>

        <q-inner-loading
          :showing="
            bot &&
            (botState.isConnected || !botMeta.requiresConnect) &&
            !botState.isTeiOk &&
            !botState.isReady
          "
        />
      </smooth-reflow>

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

      <!-- Save Comments -->
      <q-btn
        @click="bot.saveEvalComments()"
        class="full-width"
        color="primary"
        icon="notes"
        :label="$t('Save to Notes')"
        :disable="!hasResults"
        stretch
      />

      <!-- Clear Rersults -->
      <q-btn
        @click="clearResults"
        class="full-width"
        color="primary"
        icon="delete"
        :label="$t('analysis.Clear Results')"
        :disable="!hasResults"
        stretch
      />
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
      logScrollTop: 0,
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
    hasResults() {
      return !isEmpty(this.positions);
    },
    suggestions() {
      return this.positions[this.tps] || [];
    },
    pvLimit: {
      get() {
        return this.$store.state.analysis.pvLimit;
      },
      set(value) {
        this.$store.dispatch("analysis/SET", ["pvLimit", value]);
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
    setBotOptions() {
      this.botSettings[this.botID].options = {
        ...this.botSettings[this.botID].options,
        ...this.botOptions,
      };
      this.bot.applyOptions();
    },
    async scrollLog() {
      await this.$nextTick();
      if (this.$refs.botLog && this.botSettings[this.botID].log) {
        this.$refs.botLog.scrollTo({
          top: this.$refs.botLog.scrollHeight,
          behavior: "instant",
        });
      }
    },
    handleLogScroll() {
      if (
        this.autoScrollLog &&
        this.logScrollTop > this.$refs.botLog.scrollTop
      ) {
        this.autoScrollLog = false;
      } else {
        this.logScrollTop = this.$refs.botLog.scrollTop;
      }
    },
    clearLog() {
      this.bot.clearLog();
      this.logScrollTop = 0;
      this.autoScrollLog = true;
    },
    clearResults() {
      this.prompt({
        title: this.$t("Confirm"),
        message: this.$tc("confirm.clearBotResults"),
        success: () => {
          this.bot.clearResults();
        },
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
    botLog() {
      if (this.autoScrollLog) {
        this.scrollLog();
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

  div {
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
