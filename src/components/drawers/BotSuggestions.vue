<template>
  <div>
    <q-expansion-item
      v-model="sections.botSuggestions"
      header-class="bg-accent"
    >
      <template v-slot:header>
        <q-item-section avatar>
          <q-icon name="bot" />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ $t("analysis.Bot Moves") }}</q-item-label>
          <q-item-label v-if="botID" caption>
            <template v-if="bot.meta.name">
              <span class="text-bold">{{ bot.meta.name }}</span>
              <template v-if="bot.meta.author">
                {{ $t("tei.by") }} {{ bot.meta.author }}
              </template>
            </template>
            <template v-else>
              {{ $t(`analysis.bots.${botID}`) }}
            </template>
          </q-item-label>
        </q-item-section>
        <q-item-section
          v-if="!sections.botSuggestions && bot.state.isRunning"
          side
        >
          <q-spinner size="sm" />
        </q-item-section>
        <q-item-section side>
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
            :options="bots"
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
          </q-select>

          <q-separator />

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

          <!-- Limit Type -->
          <template v-if="bot.meta.limitTypes.length > 1">
            <q-item v-for="type in limitTypes" :key="type.value">
              <q-item-section>
                <BotLimitInput
                  v-model.number="botSettings[botID][type.value]"
                  :label="type.label"
                  :type="type.value"
                  :disable="
                    bot.state.isRunning ||
                    !botSettings[botID].limitTypes.includes(type.value)
                  "
                  filled
                />
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="botSettings[botID].limitTypes"
                  :val="type.value"
                  :disable="
                    bot.state.isRunning ||
                    (botSettings[botID].limitTypes.includes(type.value) &&
                      botSettings[botID].limitTypes.length === 1)
                  "
                  filled
                />
              </q-item-section>
            </q-item>
          </template>
          <BotLimitInput
            v-else-if="limitTypes[0]"
            v-model="botSettings[botID][limitTypes[0].value]"
            :type="limitTypes[0].value"
            :label="limitTypes[0].label"
            :disable="bot.state.isRunning"
            filled
            item-aligned
          />

          <!-- Other Bot Options -->
          <template v-if="bot && bot.hasOptions">
            <q-separator />

            <BotOptionInput
              v-for="(option, name) in bot.meta.options"
              :key="name"
              v-model="botOptions[name]"
              :option="option"
              :name="name"
              :disable="bot.state.isRunning || bot.isInteractiveEnabled"
              @action="bot.sendAction"
              filled
              item-aligned
            />

            <q-btn
              @click="setBotOptions"
              icon="apply"
              :label="$t('analysis.Apply Options')"
              :loading="bot.state.isReadying"
              class="full-width"
              color="primary"
              :flat="areBotOptionsApplied"
              stretch
            />
          </template>

          <!-- TEI Connection Settings -->
          <template v-if="bot && botID === 'tei'">
            <q-separator />
            <q-expansion-item
              icon="connect"
              :label="$t('Connection Settings')"
              :default-opened="!bot.state.isConnected"
            >
              <q-list>
                <q-item class="row q-gutter-x-sm">
                  <div class="col">
                    <!-- Address -->
                    <q-input
                      v-model.number="botSettings[botID].address"
                      :label="$t('tei.address')"
                      :prefix="bot.protocol"
                      filled
                      :disable="bot.state.isConnected || bot.state.isConnecting"
                    />
                  </div>

                  <div class="col">
                    <!-- Port -->
                    <q-input
                      v-model.number="botSettings[botID].port"
                      :label="$t('tei.port')"
                      type="number"
                      min="0"
                      max="65535"
                      step="1"
                      prefix=":"
                      filled
                      clearable
                      :disable="bot.state.isConnected || bot.state.isConnecting"
                    />
                  </div>
                </q-item>

                <!-- Use SSL -->
                <q-item
                  tag="label"
                  :disable="bot.state.isConnected || bot.state.isConnecting"
                  clickable
                  v-ripple
                >
                  <q-item-section side>
                    <q-checkbox
                      v-model="botSettings[botID].ssl"
                      :disable="bot.state.isConnected || bot.state.isConnecting"
                    />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ $t("tei.ssl") }}</q-item-label>
                  </q-item-section>
                </q-item>

                <!-- Log messages -->
                <q-item tag="label" clickable v-ripple>
                  <q-item-section side>
                    <q-checkbox v-model="botSettings[botID].log" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ $t("tei.log") }}</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-expansion-item>

            <!-- Disconnect -->
            <q-btn
              v-if="bot.state.isConnected"
              @click="bot.disconnect()"
              icon="disconnect"
              :label="$t('tei.disconnect')"
              class="full-width"
              color="primary"
              stretch
            />
          </template>
        </template>
      </smooth-reflow>

      <!-- Controls -->
      <smooth-reflow class="relative-position">
        <template v-if="bot">
          <!-- Connect -->
          <q-btn
            v-if="botID === 'tei' && !bot.state.isConnected"
            @click="bot.connect()"
            :loading="bot.state.isConnecting"
            :disabled="!botSettings[botID].address"
            icon="connect"
            :label="$t('tei.connect')"
            class="full-width"
            color="primary"
            stretch
          />
          <q-btn
            v-else-if="
              botID === 'tei' && bot.state.isConnected && !bot.state.isReady
            "
            @click="bot.applyOptions()"
            icon="apply"
            :label="$t('analysis.init')"
            :loading="bot.state.isReadying"
            class="full-width"
            color="primary"
            stretch
          />

          <!-- Analyze Full-Game/Branch -->
          <div class="relative-position">
            <q-btn
              @click="bot.analyzeGame()"
              :loading="bot.state.isAnalyzingGame"
              :percentage="bot.state.progress"
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
            <PlyChip
              v-if="bot.state.isAnalyzingGame && bot.state.analyzingPly"
              :ply="bot.state.analyzingPly"
              @click.stop="goToAnalysisPly"
              no-branches
              :done="bot.state.tps === bot.state.analyzingPly.afterTPS"
              class="absolute-left"
            />
            <q-btn
              v-if="bot.state.isAnalyzingGame"
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
                bot.state.isAnalyzingPosition
                  ? null
                  : bot.analyzeCurrentPosition()
              "
              :loading="bot.state.isAnalyzingPosition"
              :percentage="bot.state.progress"
              :disable="!bot.isAnalyzePositionAvailable"
              class="full-width"
              color="primary"
              icon="board"
              :label="$t('analysis.Analyze Position')"
              stretch
            />
            <PlyChip
              v-if="bot.state.isAnalyzingPosition && bot.state.analyzingPly"
              :ply="allPlies[bot.state.analyzingPly.id]"
              @click.stop="goToAnalysisPly"
              no-branches
              :done="bot.state.tps === bot.state.analyzingPly.afterTPS"
              class="absolute-left"
            />
            <q-btn
              v-if="bot.state.isAnalyzingPosition"
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

          <!-- Interactive Analysis -->
          <q-item
            v-if="bot.isInteractive"
            class="interactive-control"
            tag="label"
            :disabled="!bot.isInteractiveAvailable"
            :clickable="bot.isInteractiveAvailable"
            v-ripple="bot.isInteractiveAvailable"
          >
            <q-item-section avatar>
              <q-spinner
                v-if="bot.isInteractiveEnabled && bot.state.isRunning"
                size="sm"
              />
              <q-icon v-else name="int_analysis" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{
                $t("analysis.interactiveAnalysis")
              }}</q-item-label>
            </q-item-section>
            <q-item-section v-if="bot.isInteractiveEnabled" side>
              <div v-if="bot.state.time !== null" class="text-caption">
                {{ $n((bot.state.time || 0) / 1e3, "n0") }}
                {{ $t("analysis.secondsUnit") }}
              </div>
              <div v-if="bot.state.nps !== null" class="text-caption">
                {{ $n(bot.state.nps || 0, "n0") }}
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
        </template>

        <q-inner-loading
          :showing="
            bot &&
            (bot.state.isConnected || !bot.connect) &&
            !bot.state.isTeiOk &&
            !bot.state.isReady
          "
        />
      </smooth-reflow>

      <!-- Results -->
      <smooth-reflow>
        <AnalysisItem
          v-for="(suggestion, i) in suggestions.slice(
            0,
            botSettings[botID].maxSuggestedMoves
          )"
          :key="i"
          :ply="suggestion.ply"
          :evaluation="
            'evaluation' in suggestion ? suggestion.evaluation : null
          "
          :following-plies="suggestion.followingPlies"
          :count="
            'visits' in suggestion
              ? suggestion.visits
              : 'nodes' in suggestion
              ? suggestion.nodes
              : null
          "
          :count-label="
            'visits' in suggestion
              ? 'analysis.visits'
              : 'nodes' in suggestion
              ? 'analysis.nodes'
              : null
          "
          :player1-number="
            'evaluation' in suggestion && suggestion.evaluation >= 0
              ? bot.formatEvaluation(suggestion.evaluation)
              : null
          "
          :player2-number="
            'evaluation' in suggestion && suggestion.evaluation < 0
              ? bot.formatEvaluation(suggestion.evaluation)
              : null
          "
          :depth="suggestion.depth || null"
          :animate="bot.isInteractiveEnabled"
        />

        <q-item v-if="isGameEnd" class="flex-center">
          {{ $t("analysis.gameOver") }}
        </q-item>
      </smooth-reflow>

      <!-- Secondary Controls -->
      <smooth-reflow>
        <!-- Think Harder -->
        <q-btn
          v-if="
            bot &&
            bot.id === 'tiltak-cloud' &&
            suggestions.length &&
            suggestions.every(({ movetime }) => movetime < bot.movetime.long)
          "
          @click="bot.analyzeCurrentPosition(bot.movetime.long)"
          :loading="bot.state.isAnalyzingPosition"
          class="full-width"
          color="primary"
          stretch
        >
          {{ $t("analysis.Think Harder") }}
        </q-btn>

        <!-- Save Comments -->
        <div class="row no-wrap">
          <q-btn
            @click="bot.saveEvalComments()"
            class="full-width"
            color="primary"
            icon="notes"
            :label="$t('Save to Notes')"
            stretch
          />
        </div>
      </smooth-reflow>
    </q-expansion-item>
  </div>
</template>

<script>
import AnalysisItem from "../analysis/AnalysisItem";
import BotLimitInput from "../analysis/BotLimitInput";
import BotOptionInput from "../analysis/BotOptionInput";
import PlyChip from "../PTN/Ply.vue";
import { cloneDeep, isEqual } from "lodash";

export default {
  name: "BotSuggestions",
  components: { AnalysisItem, BotLimitInput, BotOptionInput, PlyChip },
  data() {
    return {
      showBotSettings: false,
      botSettings: cloneDeep(this.$store.state.analysis.botSettings),
      botOptions: this.bot ? this.bot.getOptions() : {},
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
    bots() {
      return this.$store.state.analysis.bots;
    },
    bot() {
      return this.$store.getters["analysis/bot"];
    },
    positions() {
      return this.$store.state.analysis.botPositions;
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
        if (this.bot.meta.limitTypes.includes("depth")) {
          types.push({ label: this.$t("analysis.Depth"), value: "depth" });
        }
        if (this.bot.meta.limitTypes.includes("movetime")) {
          types.push({
            label: this.$t("analysis.movetime"),
            value: "movetime",
          });
        }
        if (this.bot.meta.limitTypes.includes("nodes")) {
          types.push({ label: this.$t("analysis.Nodes"), value: "nodes" });
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
      await this.bot.setOptions(this.botOptions);
      this.bot.applyOptions();
    },
    goToAnalysisPly() {
      if (this.bot && this.bot.state.analyzingPly) {
        this.$store.dispatch("game/GO_TO_PLY", {
          plyID: this.bot.state.analyzingPly.id,
          isDone: this.bot.state.analyzingPly.isDone,
        });
      }
    },
  },

  watch: {
    suggestions(suggestions) {
      const suggestion = suggestions[0];
      if (suggestion && "evaluation" in suggestion) {
        this.$store.dispatch("game/SET_EVAL", suggestion.evaluation);
      } else {
        this.$store.dispatch("game/SET_EVAL", null);
      }
    },
    sections: {
      handler(value) {
        this.$store.dispatch("ui/SET_UI", ["analysisSections", value]);
      },
      deep: true,
    },
    bot(newBot, oldBot) {
      if (oldBot && oldBot.id !== newBot.id) {
        // Stop interactive analysis when switching bots
        if (oldBot.isInteractive && oldBot.isInteractiveEnabled) {
          oldBot.isInteractiveEnabled = false;
        }
      }
    },
    botSettings: {
      handler(settings) {
        this.$store.dispatch("analysis/SET", ["botSettings", settings]);
      },
      deep: true,
    },
    "bot.meta.options": {
      handler() {
        // Reset the buffer
        this.botOptions = this.bot.getOptions();

        // // Save TEI options
        // if (this.botID === "tei") {
        //   let optionValues = { ...(this.botSettings.options || {}) };
        //   forEach(options, (option, name) => {
        //     if (!("value" in option)) {
        //       return;
        //     }
        //     if (!("default" in option) || option.value !== option.default) {
        //       optionValues[name] = option.value;
        //     } else {
        //       delete optionValues[name];
        //     }
        //   });
        //   this.$set(this.botSettings.tei, "options", optionValues);
        // }
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
</style>
