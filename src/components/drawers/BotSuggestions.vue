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
          <q-item-label v-if="botSettings.bot" caption>{{
            $t(`analysis.bots.${botSettings.bot}`)
          }}</q-item-label>
        </q-item-section>
        <q-item-section
          v-if="!sections.botSuggestions && bot.status.isRunning"
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
            v-model="botSettings.bot"
            :options="botOptions"
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

          <!-- Tiltak Cloud -->
          <template v-if="botSettings.bot === 'tiltak-cloud'">
            <!-- Max Suggestions -->
            <q-input
              v-model.number="botSettings[botSettings.bot].maxSuggestedMoves"
              :label="$t('analysis.maxSuggestedMoves')"
              type="number"
              min="1"
              max="20"
              step="1"
              item-aligned
              filled
            >
              <template v-slot:prepend>
                <q-icon name="moves" />
              </template>
            </q-input>
          </template>

          <!-- Topaz -->
          <template v-if="botSettings.bot === 'topaz'">
            <!-- Depth -->
            <q-input
              v-model.number="botSettings[botSettings.bot].depth"
              :label="$t('analysis.Depth')"
              type="number"
              min="2"
              max="99"
              step="1"
              item-aligned
              filled
            >
              <template v-slot:prepend>
                <q-icon name="depth" />
              </template>
            </q-input>

            <!-- Time Budget -->
            <q-input
              v-model.number="botSettings[botSettings.bot].timeBudget"
              :label="$t('analysis.timeBudget')"
              type="number"
              min="1"
              max="999"
              step="1"
              item-aligned
              filled
            >
              <template v-slot:prepend>
                <q-icon name="clock" />
              </template>
            </q-input>
          </template>

          <!-- TEI -->
          <template v-if="bot && botSettings.bot === 'tei'">
            <q-item class="row q-gutter-x-sm">
              <div class="col">
                <!-- Address -->
                <q-input
                  v-model.number="botSettings.tei.address"
                  :label="$t('tei.address')"
                  :prefix="bot.protocol"
                  filled
                  :disable="bot.status.isConnected || bot.status.isConnecting"
                />
              </div>

              <div class="col">
                <!-- Port -->
                <q-input
                  v-model.number="botSettings.tei.port"
                  :label="$t('tei.port')"
                  type="number"
                  min="0"
                  max="65535"
                  step="1"
                  prefix=":"
                  filled
                  clearable
                  :disable="bot.status.isConnected || bot.status.isConnecting"
                />
              </div>
            </q-item>

            <!-- Use SSL -->
            <q-item
              tag="label"
              :disable="bot.status.isConnected || bot.status.isConnecting"
              clickable
              v-ripple
            >
              <q-item-section side>
                <q-checkbox
                  v-model="botSettings.tei.ssl"
                  :disable="bot.status.isConnected || bot.status.isConnecting"
                />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ $t("tei.ssl") }}</q-item-label>
              </q-item-section>
            </q-item>

            <!-- Log messages -->
            <q-item tag="label" clickable v-ripple>
              <q-item-section side>
                <q-checkbox v-model="botSettings.tei.log" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ $t("tei.log") }}</q-item-label>
              </q-item-section>
            </q-item>

            <!-- Disconnect -->
            <q-btn
              v-if="bot.status.isConnected"
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
      <smooth-reflow>
        <!-- TEI -->
        <template v-if="bot && bot.id === 'tei'">
          <q-item
            v-if="bot.status.isConnected"
            class="interactive-control"
            tag="label"
            clickable
            v-ripple
          >
            <q-item-section avatar>
              <q-spinner v-if="bot.status.isInteractiveRunning" size="sm" />
              <q-icon v-else name="int_analysis" />
            </q-item-section>
            <q-item-section>
              <q-item-label>
                {{ $t("tei.run") }}
                <template v-if="bot.meta.name">{{ bot.meta.name }}</template>
              </q-item-label>
              <q-item-label v-if="bot.meta.author" caption>
                {{ $t("tei.by") }} {{ bot.meta.author }}
              </q-item-label>
            </q-item-section>
            <q-item-section v-if="bot.isInteractiveEnabled" side>
              <div v-if="bot.status.time !== null" class="text-caption">
                {{ $n((bot.status.time || 0) / 1e3, "n0") }}
                {{ $t("analysis.secondsUnit") }}
              </div>
              <div v-if="bot.status.nps !== null" class="text-caption">
                {{ $n(bot.status.nps || 0, "n0") }}
                {{ $t("analysis.nps") }}
              </div>
            </q-item-section>
            <q-item-section side>
              <q-toggle v-model="bot.isInteractiveEnabled" />
            </q-item-section>
          </q-item>
          <q-btn
            v-else
            @click="bot.connect()"
            :loading="bot.status.isConnecting"
            :disabled="!botSettings.tei.address"
            icon="connect"
            :label="$t('tei.connect')"
            class="full-width"
            color="primary"
            stretch
          />

          <!-- TEI Options -->
          <smooth-reflow>
            <template v-if="bot.hasOptions">
              <q-separator />
              <template v-for="(option, name) in bot.meta.options">
                <q-item
                  v-if="option.type === 'check'"
                  :key="name"
                  type="label"
                  :disable="bot.status.isRunning"
                  clickable
                  v-ripple
                >
                  <q-item-section side>
                    <q-checkbox
                      v-model="option.value"
                      @input="bot.setOption(name, $event)"
                      :disable="bot.status.isRunning"
                    />
                    <q-item-section>
                      <q-item-label>{{ name }}</q-item-label>
                    </q-item-section>
                  </q-item-section>
                </q-item>
                <q-input
                  v-if="option.type === 'spin'"
                  type="number"
                  :key="name"
                  v-model.number="option.value"
                  @input="bot.setOption(name, $event)"
                  :label="name"
                  :min="option.min"
                  :max="option.max"
                  :disable="bot.status.isRunning"
                  filled
                  item-aligned
                />
                <q-select
                  v-if="option.type === 'combo'"
                  :key="name"
                  v-model="option.value"
                  @input="bot.setOption(name, $event)"
                  :options="option.vars"
                  :label="name"
                  :disable="bot.status.isRunning"
                  filled
                  item-aligned
                />
                <q-btn
                  v-if="option.type === 'button'"
                  :key="name"
                  :label="name"
                  @click="bot.send(name)"
                  :disable="bot.status.isRunning"
                  class="full-width"
                  color="primary"
                  stretch
                />
                <q-input
                  v-if="option.type === 'string'"
                  :key="name"
                  v-model="option.value"
                  @input="bot.setOption(name, $event)"
                  :label="name"
                  :disable="bot.status.isRunning"
                  filled
                  item-aligned
                />
              </template>
              <q-separator />
            </template>
          </smooth-reflow>
        </template>

        <!-- Tiltak Cloud -->
        <template v-else-if="botSettings.bot === 'tiltak-cloud'">
          <q-btn
            v-if="!bot.isFullyAnalyzed && plies.length"
            @click="bot.analyzeGame()"
            :loading="bot.status.isAnalyzingGame"
            :percentage="bot.status.progress"
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
          <q-btn
            v-if="!suggestions.length && !isGameEnd"
            @click="bot.analyzePosition(bot.secondsToThink.short)"
            :loading="bot.status.isAnalyzingPosition"
            class="full-width"
            color="primary"
            icon="board"
            :label="$t('analysis.Analyze Position')"
            stretch
          />
        </template>

        <!-- Generic Interactive -->
        <template v-else-if="bot && bot.isInteractive">
          <q-item class="interactive-control" tag="label" clickable v-ripple>
            <q-item-section avatar>
              <q-spinner v-if="bot.status.isInteractiveRunning" size="sm" />
              <q-icon v-else name="int_analysis" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{
                $t("analysis.interactiveAnalysis")
              }}</q-item-label>
            </q-item-section>
            <q-item-section v-if="bot.isInteractiveEnabled" side>
              <div v-if="bot.status.time !== null" class="text-caption">
                {{ $n((bot.status.time || 0) / 1e3, "n0") }}
                {{ $t("analysis.secondsUnit") }}
              </div>
              <div v-if="bot.status.nps !== null" class="text-caption">
                {{ $n(bot.status.nps || 0, "n0") }}
                {{ $t("analysis.nps") }}
              </div>
            </q-item-section>
            <q-item-section side>
              <q-toggle v-model="bot.isInteractiveEnabled" />
            </q-item-section>
          </q-item>
        </template>

        <!-- Generic Non-Interactive -->
        <div v-else-if="bot" class="relative-position">
          <q-btn
            v-if="
              !isGameEnd &&
              (!suggestions.length ||
                bot.getSettingsHash() !== suggestions[0].hash)
            "
            @click="
              bot.status.isAnalyzingPosition ? null : bot.analyzePosition()
            "
            :percentage="bot.status.progress"
            class="full-width"
            color="primary"
            icon="board"
            :label="$t('analysis.Analyze Position')"
            :loading="bot.status.isAnalyzingPosition"
            :ripple="!bot.status.isAnalyzingPosition"
            stretch
          />
          <PlyChip
            v-if="bot.status.isAnalyzingPosition && bot.status.analyzingPly"
            :ply="allPlies[bot.status.analyzingPly.id]"
            @click.stop="goToAnalysisPly"
            no-branches
            :done="bot.status.analyzingPly.isDone"
            class="absolute-left"
          />
          <q-btn
            v-if="bot.status.isAnalyzingPosition"
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
      </smooth-reflow>

      <!-- Results -->
      <smooth-reflow>
        <AnalysisItem
          v-for="(suggestion, i) in suggestions.slice(
            0,
            botSettings[botSettings.bot].maxSuggestedMoves
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
          :animate="['tiltak', 'tei'].includes(botSettings.bot)"
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
            suggestions.every(
              ({ secondsToThink }) => secondsToThink < bot.secondsToThink.long
            )
          "
          @click="bot.analyzePosition(bot.secondsToThink.long)"
          :loading="bot.status.isAnalyzingPosition"
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
          <q-input
            type="number"
            v-model.number="botSettings[botSettings.bot].pvLimit"
            :label="$t('analysis.pvLimit')"
            :min="0"
            :max="20"
            item-align
            filled
            dense
          />
        </div>
      </smooth-reflow>
    </q-expansion-item>
  </div>
</template>

<script>
import { cloneDeep } from "lodash";
import AnalysisItem from "../database/AnalysisItem";
import PlyChip from "../PTN/Ply.vue";
import { bots, botOptions } from "../../bots";

export default {
  name: "BotSuggestions",
  components: { AnalysisItem, PlyChip },
  data() {
    return {
      showBotSettings: false,
      bots,
      botOptions,
      botSettings: cloneDeep(this.$store.state.ui.botSettings),
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
    bot() {
      return this.bots[this.botSettings.bot];
    },
    positions() {
      return this.bot ? this.bot.positions : {};
    },
    suggestions() {
      return this.positions[this.tps] || [];
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

    goToAnalysisPly() {
      if (this.bot && this.bot.status.analyzingPly) {
        this.$store.dispatch("game/GO_TO_PLY", {
          plyID: this.bot.status.analyzingPly.id,
          isDone: this.bot.status.analyzingPly.isDone,
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
    botSettings: {
      handler(settings) {
        // Save preferences
        this.$store.dispatch("ui/SET_UI", ["botSettings", settings]);
      },
      deep: true,
    },
    "bot.meta.options": {
      handler(options) {
        // Save TEI options
        if (this.botSettings.bot === "tei") {
          let optionValues = { ...(this.botSettings.tei.options || {}) };
          Object.keys(options).forEach((key) => {
            if (
              "value" in options[key] &&
              (!("default" in options[key]) ||
                options[key].value !== options[key].default)
            ) {
              optionValues[key] = options[key].value;
            }
          });
          this.$set(this.botSettings.tei, "options", optionValues);
        }
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
