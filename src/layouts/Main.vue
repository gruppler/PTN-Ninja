<template>
  <q-layout v-if="gameExists" class="non-selectable" view="lHr LpR lFr">
    <q-header elevated class="bg-ui">
      <q-toolbar class="q-pa-none">
        <q-btn
          icon="moves"
          @click="showPTN = !showPTN"
          :color="showPTN ? 'primary' : ''"
          stretch
          flat
        >
          <hint>{{ $t(showPTN ? "Hide PTN" : "Show PTN") }}</hint>
        </q-btn>
        <q-toolbar-title class="q-pa-none">
          <GameSelector ref="gameSelector">
            <q-icon
              name="menu_vertical"
              @click.stop.prevent
              @click.right.prevent.stop
              class="q-field__focusable-action q-mr-sm"
            >
              <q-menu
                transition-show="none"
                transition-hide="none"
                auto-close
                square
              >
                <q-list>
                  <!-- Info -->
                  <q-item @click="info" clickable>
                    <q-item-section side>
                      <q-icon name="info" />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label>
                        {{ $t("View Game Info") }}
                      </q-item-label>
                    </q-item-section>
                  </q-item>
                  <!-- Edit -->
                  <q-item @click="edit" clickable>
                    <q-item-section side>
                      <q-icon name="edit" />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label>
                        {{ $t("Edit Game") }}
                      </q-item-label>
                    </q-item-section>
                  </q-item>
                  <!-- Duplicate -->
                  <q-item @click="duplicate" clickable>
                    <q-item-section side>
                      <q-icon name="copy" />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label>
                        {{ $t("Duplicate") }}
                      </q-item-label>
                    </q-item-section>
                  </q-item>
                  <q-separator />
                  <!-- Account -->
                  <q-item @click="account" clickable>
                    <q-item-section side>
                      <q-icon name="account" />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label>
                        {{ $t("Account") }}
                      </q-item-label>
                    </q-item-section>
                  </q-item>
                  <!-- Online -->
                  <q-item @click="online" clickable>
                    <q-item-section side>
                      <q-icon name="online" />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label>
                        {{ $tc("Online Game", 0) }}
                      </q-item-label>
                    </q-item-section>
                  </q-item>
                  <q-separator />
                  <!-- Share -->
                  <q-item @click="share" clickable>
                    <q-item-section side>
                      <q-icon name="share" />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label>
                        {{ $t("Share") }}
                      </q-item-label>
                    </q-item-section>
                  </q-item>
                  <!-- UI Preferences -->
                  <q-item @click="settings" clickable>
                    <q-item-section side>
                      <q-icon name="settings" />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label>
                        {{ $t("UI Preferences") }}
                      </q-item-label>
                    </q-item-section>
                  </q-item>
                  <!-- Help -->
                  <q-item @click="help" clickable>
                    <q-item-section side>
                      <q-icon name="help" />
                    </q-item-section>
                    <q-item-section>
                      <q-item-label>
                        {{ $t("Help") }}
                      </q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-icon>
          </GameSelector>
        </q-toolbar-title>
        <q-btn
          :icon="textPanelIcon"
          @click.left="showText = !showText"
          @click.right.prevent="notifyNotes = !notifyNotes"
          :color="showText ? 'primary' : ''"
          stretch
          flat
        >
          <hint v-if="textPanelHint">{{ textPanelHint }}</hint>
        </q-btn>
      </q-toolbar>
    </q-header>

    <q-page-container
      class="bg-bg"
      v-shortkey="hotkeys.UI"
      @shortkey="uiShortkey"
    >
      <q-page
        v-shortkey="hotkeys.DIALOGS"
        @shortkey="dialogShortkey"
        class="overflow-hidden"
      >
        <div
          class="column absolute-fit"
          v-shortkey="hotkeys.MISC"
          @shortkey="miscShortkey"
        >
          <Board class="col-grow" />
        </div>
        <BoardToggles v-if="!isDialogShowing" />
        <q-page-sticky position="bottom" :offset="[0, 0]">
          <CurrentMove style="margin-right: 65px" />
        </q-page-sticky>
        <q-page-sticky position="bottom-right" :offset="[18, 18]">
          <q-btn
            color="primary"
            :text-color="
              $store.state.ui.theme.primaryDark ? 'textLight' : 'textDark'
            "
            icon="add"
            @click="addGame"
            @click.right.prevent="switchGame"
            fab
          />
          <hint>{{ $t("Add Game") }}</hint>
        </q-page-sticky>
        <q-page-sticky
          ref="notificationContainerTopLeft"
          position="top-left"
          @click="clickNotification"
        />
        <q-page-sticky
          ref="notificationContainerTopRight"
          position="top-right"
          @click="clickNotification"
        />
        <q-page-sticky
          ref="notificationContainerBottomLeft"
          position="bottom-left"
          @click="clickNotification"
        />
        <q-page-sticky
          ref="notificationContainerBottomRight"
          position="bottom-right"
          @click="clickNotification"
        />
        <q-page-sticky
          ref="notificationContainerLeft"
          position="left"
          @click="clickNotification"
        />
        <q-page-sticky
          ref="notificationContainerRight"
          position="right"
          @click="clickNotification"
        />
      </q-page>
    </q-page-container>

    <q-drawer
      id="left-drawer"
      v-model="showPTN"
      side="left"
      :width="panelWidth"
      :breakpoint="showText ? doubleWidth : singleWidth"
      :no-swipe-open="!Platform.is.mobile"
      :no-swipe-close="!Platform.is.mobile"
      persistent
    >
      <div class="absolute-fit column">
        <PTN-Tools ref="tools">
          <ShareButton ref="shareButton" flat stretch />
        </PTN-Tools>
        <div class="col-grow relative-position">
          <PTN class="absolute-fit" />
        </div>
        <q-toolbar class="footer-toolbar bg-ui q-pa-none">
          <UndoButtons spread stretch flat unelevated />
          <EvalButtons class="full-width" spread stretch flat unelevated />
        </q-toolbar>
      </div>
      <div class="gt-xs absolute-fit inset-shadow no-pointer-events" />
    </q-drawer>

    <q-drawer
      id="right-drawer"
      v-model="showText"
      side="right"
      :width="panelWidth"
      :breakpoint="showPTN ? doubleWidth : singleWidth"
      :no-swipe-open="!Platform.is.mobile"
      :no-swipe-close="!Platform.is.mobile"
      persistent
    >
      <div class="absolute-fit column">
        <q-tabs
          class="bg-ui text-weight-medium"
          :value="textTab"
          @input="showTextTab"
          active-color="primary"
          indicator-color="primary"
          align="justify"
          inline-label
        >
          <q-tab
            v-if="hasAnalysis"
            name="analysis"
            icon="analysis"
            :label="$tc('Analysis')"
          />
          <q-tab name="notes" icon="notes" :label="$t('Notes')" />
          <q-tab v-if="hasChat" name="chat" icon="chat" :label="$t('Chat')" />
        </q-tabs>
        <q-tab-panels
          class="col-grow bg-transparent"
          :value="textTab"
          keep-alive
          animated
        >
          <q-tab-panel name="analysis">
            <Analysis v-if="hasAnalysis" ref="analysis" class="fit" recess />
          </q-tab-panel>
          <q-tab-panel name="notes">
            <Notes ref="notes" class="fit" recess />
          </q-tab-panel>
          <q-tab-panel v-if="hasChat" name="chat">
            <Chat ref="chat" class="fit" recess />
          </q-tab-panel>
        </q-tab-panels>
      </div>
      <div class="gt-xs absolute-fit inset-shadow no-pointer-events" />
    </q-drawer>

    <q-footer class="bg-panel">
      <q-btn
        v-if="hasAnalysis && $q.screen.height >= singleWidth"
        @click="showToolbarAnalysis = !showToolbarAnalysis"
        :icon="showToolbarAnalysis ? 'down' : 'up'"
        class="toolbar-analysis-toggle dimmed-btn absolute"
        :ripple="false"
        :color="$store.state.ui.theme.secondaryDark ? 'textLight' : 'textDark'"
        dense
        flat
      />
      <smooth-reflow class="relative-position">
        <template
          v-if="
            showToolbarAnalysis &&
            hasAnalysis &&
            $q.screen.height >= singleWidth
          "
        >
          <template
            v-if="
              botSuggestion ||
              botState.isInteractiveEnabled ||
              botState.isAnalyzingGame ||
              (botState.isRunning && botState.tps === this.tps)
            "
          >
            <q-linear-progress
              v-if="botState.isRunning"
              class="analysis-linear-progress"
              size="2px"
              :value="botState.progress / 100"
              :indeterminate="
                botState.isInteractiveEnabled || !botState.progress
              "
            />
            <BotAnalysisItem
              v-if="botSuggestion"
              :suggestion="botSuggestion"
              fixed-height
              class="toolbar-analysis-height"
            />
            <AnalysisItemPlaceholder v-else class="toolbar-analysis-height" />
          </template>
          <q-item
            v-else-if="isGameEnd"
            class="flex-center toolbar-analysis-height"
          >
            {{ $t("analysis.gameOver") }}
          </q-item>
          <q-btn
            v-else-if="botMeta.requiresConnect && !botState.isConnected"
            @click="bot.connect()"
            :loading="botState.isConnecting"
            icon="connect"
            :label="$t('tei.connect')"
            class="full-width toolbar-analysis-height"
            color="primary"
            stretch
          />
          <q-btn-group v-else spread stretch>
            <q-btn
              @click="
                botState.isAnalyzingPosition
                  ? null
                  : bot.analyzeCurrentPosition()
              "
              :loading="botState.isAnalyzingPosition"
              :disable="!bot.isAnalyzePositionAvailable"
              class="full-width toolbar-analysis-height"
              color="primary"
              icon="board"
              :label="$t('analysis.Analyze Position')"
            />
            <q-btn
              @click="bot.analyzeGame()"
              :loading="botState.isAnalyzingGame"
              :disable="!bot.isAnalyzeGameAvailable"
              class="full-width"
              color="primary"
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
          </q-btn-group>
        </template>
      </smooth-reflow>

      <div class="relative-position">
        <Scrubber />

        <q-toolbar
          v-show="
            isHighlighting || isEditingTPS || $store.state.ui.showControls
          "
          class="footer-toolbar bg-ui"
        >
          <Highlighter
            v-if="isHighlighting"
            class="justify-around items-center"
            style="width: 100%; max-width: 500px; margin: 0 auto"
          />
          <PieceSelector
            v-else-if="isEditingTPS"
            class="justify-around items-center"
            style="width: 100%; max-width: 500px; margin: 0 auto"
          />
          <PlayControls ref="playControls" v-else />
        </q-toolbar>
      </div>
    </q-footer>

    <router-view ref="dialog" go-back no-route-dismiss />

    <ErrorNotifications :errors="errors" />
    <GameNotifications ref="gameNotifications" />
    <NoteNotifications ref="noteNotifications" />
  </q-layout>
  <q-dialog v-else-if="gamesInitialized" :value="true" persistent>
    No Game
  </q-dialog>
  <q-inner-loading v-else showing />
</template>

<script>
// Essentials:
import Board from "../components/board/Board";
import CurrentMove from "../components/board/CurrentMove";
import PTN from "../components/drawers/PTN";
import Notes from "../components/drawers/Notes";
import Analysis from "../components/drawers/Analysis";

// Notifications:
import ErrorNotifications from "../components/notify/ErrorNotifications";
import GameNotifications from "../components/notify/GameNotifications";
import NoteNotifications from "../components/notify/NoteNotifications";

// Controls:
import PlayControls from "../components/controls/PlayControls";
import Scrubber from "../components/controls/Scrubber";
import PTNTools from "../components/controls/PTNTools";
import UndoButtons from "../components/controls/UndoButtons";
import EvalButtons from "../components/controls/EvalButtons";
import BoardToggles from "../components/controls/BoardToggles";
import ShareButton from "../components/controls/ShareButton";

// Excluded from Embed layout:
import onlineStore from "../store/online";
import analysisStore from "../store/analysis";
import GameSelector from "../components/controls/GameSelector";
import Highlighter from "../components/controls/Highlighter";
import PieceSelector from "../components/controls/PieceSelector";
import Chat from "../components/drawers/Chat";
import BotAnalysisItem from "../components/analysis/BotAnalysisItem";
import AnalysisItemPlaceholder from "../components/analysis/AnalysisItemPlaceholder";

import Game from "../Game";
import { HOTKEYS } from "../keymap";
import { parsePV } from "../utilities";

import { Platform } from "quasar";

export default {
  name: "MainLayout",
  components: {
    Board,
    CurrentMove,
    PTN,
    Notes,
    Analysis,
    ErrorNotifications,
    GameNotifications,
    NoteNotifications,
    PlayControls,
    Scrubber,
    PTNTools,
    UndoButtons,
    EvalButtons,
    BoardToggles,
    ShareButton,
    Chat,
    BotAnalysisItem,
    AnalysisItemPlaceholder,
    GameSelector,
    Highlighter,
    PieceSelector,
  },
  props: ["ptn", "state", "name", "gameID"],
  data() {
    return {
      Platform,
      errors: [],
      hotkeys: HOTKEYS,
      doubleWidth: 1025,
      singleWidth: this.$q.screen.sizes.sm,
    };
  },
  computed: {
    gamesInitialized() {
      return this.$store.state.game.init;
    },
    gameExists() {
      return Boolean(this.$store.state.game.name);
    },
    isOnline() {
      return this.gameExists ? this.$store.state.game.config.isOnline : false;
    },
    hasAnalysis() {
      return !this.isOnline;
      // TODO: Allow for ended games and spectators? And online analyses.
    },
    hasChat() {
      return (
        this.isOnline ||
        (this.$store.state.game.comments &&
          Object.keys(this.$store.state.game.comments.chatlog).length)
      );
    },
    showPTN: {
      get() {
        return this.$store.state.ui.showPTN;
      },
      set(value) {
        this.$store.dispatch("ui/SET_UI", ["showPTN", value]);
      },
    },
    showText: {
      get() {
        return this.$store.state.ui.showText;
      },
      set(value) {
        this.$store.dispatch("ui/SET_UI", ["showText", value]);
      },
    },
    showToolbarAnalysis: {
      get() {
        return this.$store.state.ui.showToolbarAnalysis;
      },
      set(value) {
        this.$store.dispatch("ui/SET_UI", ["showToolbarAnalysis", value]);
      },
    },
    textTab: {
      get() {
        let tab = this.$store.state.ui.textTab;
        if (tab === "chat" && !this.hasChat) {
          tab = "analysis";
        }
        if (tab === "analysis" && !this.hasAnalysis) {
          tab = this.hasChat ? "chat" : "notes";
        }
        return tab;
      },
      set(value) {
        this.$store.dispatch("ui/SET_UI", ["textTab", value]);
      },
    },
    notifyNotes: {
      get() {
        return this.$store.state.ui.notifyNotes;
      },
      set(value) {
        this.$store.dispatch("ui/SET_UI", ["notifyNotes", value]);
      },
    },
    textPanelIcon() {
      switch (this.textTab) {
        case "notes":
          return this.notifyNotes ? "notes" : "notes_off";
        case "chat":
          return "chat";
        case "analysis":
          return "analysis";
        default:
          return "";
      }
    },
    textPanelHint() {
      if (this.textTab === "notes") {
        return this.$t(this.showText ? "Hide Notes" : "Show Notes");
      } else if (this.textTab === "chat") {
        return this.$t(this.showText ? "Hide Chat" : "Show Chat");
      } else if (this.textTab === "analysis") {
        return this.$t(this.showText ? "Hide Analysis" : "Show Analysis");
      }
      return "";
    },
    isHighlighting() {
      return this.$store.state.ui.highlighterEnabled;
    },
    isEditingTPS() {
      return this.$store.state.game.editingTPS !== undefined;
    },
    disabledOptions() {
      return this.$store.getters["game/disabledOptions"];
    },
    isDialogShowing() {
      return !["localGame", "publicGame", "privateGame"].includes(
        this.$route.name
      );
    },
    games() {
      return this.$store.state.game.list;
    },
    user() {
      return this.$store.state.online.user;
    },
    player() {
      return this.user
        ? this.$store.getters["online/playerFromUID"](this.user.uid)
        : 0;
    },
    tps() {
      return this.$store.state.game.position.tps;
    },
    isGameEnd() {
      return (
        this.$store.state.game.position.isGameEnd &&
        !this.$store.state.game.position.isGameEndDefault
      );
    },
    showAllBranches() {
      return this.$store.state.ui.showAllBranches;
    },
    bot() {
      return this.$store.getters["analysis/bot"];
    },
    botMeta() {
      return this.$store.state.analysis.botMeta;
    },
    botState() {
      return this.$store.state.analysis.botState;
    },
    botSuggestion() {
      const suggestions = this.$store.state.analysis.botPositions[this.tps];
      if (suggestions) {
        return suggestions[0];
      }

      // Get suggestion from notes
      const game = this.$store.state.game;
      const tps = this.tps;
      const suggestion = {
        evaluation: null,
        ply: null,
        followingPlies: [],
        time: null,
      };
      let notes;
      let note;
      let ply;
      for (let id in game.comments.notes) {
        notes = game.comments.notes[id];
        ply = game.ptn.allPlies[id];
        if (suggestion.ply === null && ply.tpsBefore === tps) {
          note = notes.find((n) => n.pv !== null);
          if (note) {
            const pv = parsePV(ply.player, ply.color, note.pv[0]);
            suggestion.ply = pv.splice(0, 1)[0];
            suggestion.followingPlies = pv;
          }
        } else if (suggestion.evaluation === null && ply.tpsAfter === tps) {
          note = notes.find((n) => n.evaluation !== null);
          if (note) {
            suggestion.evaluation = note.evaluation;
          }
        }
      }

      return suggestion.ply ? suggestion : null;
    },
    isAnonymous() {
      return !this.user || this.user.isAnonymous;
    },
    panelWidth() {
      const largeWidth = 1600;
      let width = 300;
      if (this.$q.screen.width > largeWidth) {
        width += (this.$q.screen.width - largeWidth) / 4;
      }
      return Math.min(width, 400);
    },
  },
  methods: {
    async init() {
      if (this.gamesInitialized) {
        await this.getGame();

        if (!this.gameID) {
          if (!this.games.length) {
            await this.$store.dispatch("game/ADD_GAME", {
              ptn: this.$game.toString(),
              name: this.$game.name,
              state: this.$game.minState,
              config: this.$game.config,
            });
          }
        }

        const lists = document.querySelectorAll(
          ".q-notifications .q-notifications__list"
        );
        for (const list of lists) {
          if (list.classList.contains("q-notifications__list--top")) {
            if (list.classList.contains("items-start")) {
              list.style.display = "flex";
              list.classList.remove("fixed");
              this.$refs.notificationContainerTopLeft.$el.appendChild(list);
            } else if (list.classList.contains("items-end")) {
              list.style.display = "flex";
              list.classList.remove("fixed");
              this.$refs.notificationContainerTopRight.$el.appendChild(list);
            }
          } else if (list.classList.contains("q-notifications__list--bottom")) {
            if (list.classList.contains("items-start")) {
              list.style.display = "flex";
              list.classList.remove("fixed");
              this.$refs.notificationContainerBottomLeft.$el.appendChild(list);
            } else if (list.classList.contains("items-end")) {
              list.style.display = "flex";
              list.classList.remove("fixed");
              this.$refs.notificationContainerBottomRight.$el.appendChild(list);
            }
          } else if (list.classList.contains("q-notifications__list--center")) {
            if (list.classList.contains("items-start")) {
              list.style.display = "flex";
              list.classList.remove("fixed");
              this.$refs.notificationContainerLeft.$el.appendChild(list);
            } else if (list.classList.contains("items-end")) {
              list.style.display = "flex";
              list.classList.remove("fixed");
              this.$refs.notificationContainerRight.$el.appendChild(list);
            }
          }
        }
      }
    },
    clickNotification(event) {
      if (
        event.target.matches(".q-notification.note") ||
        event.target.matches(".q-notification.note .q-notification__message")
      ) {
        this.textTab = "notes";
        this.showText = true;
      } else if (
        event.target.matches(".q-notification.game") ||
        event.target.matches(".q-notification.game .q-notification__message") ||
        event.target.matches(".q-notification.game .q-notification__icon")
      ) {
        this.$refs.gameNotifications.$refs.notifications.hide();
      }
    },
    newGame() {
      const game = new Game({
        player1: this.$store.state.ui.player1,
        player2: this.$store.state.ui.player2,
        tags: { size: this.$store.state.ui.size },
      });
      return game;
    },
    async getGame() {
      let game;
      this.errors = [];

      const _handleError = (error) => {
        const name = game ? game.name : "";
        game = this.newGame();
        if (name) {
          game.name = name;
        }
        if (this.$te(`error["${error.message}"]`)) {
          this.errors.push(this.$t(`error["${error.message}"]`));
        } else {
          console.error(error);
        }
      };

      const _loadPrevious = () => {
        if (this.$store.state.game.list && this.$store.state.game.list.length) {
          try {
            game = this.$store.state.game.list[0];
            game = new Game(game);
          } catch (error) {
            _handleError(error);
          }
        }
      };

      if (this.ptn) {
        try {
          // Add game from URL
          let name = this.name;
          if (!this.name) {
            // If name isn't provided, parse the game to get a name
            game = new Game({ ptn: this.ptn, state: this.state });
            name = game.name;
          }
          const index = this.$store.state.game.list.findIndex(
            (g) => g.name === name
          );
          if (index < 0 || this.$store.state.ui.openDuplicate !== "replace") {
            // Open as a new game
            if (!game) {
              // If it hasn't been parsed yet, do it now
              game = new Game({ ptn: this.ptn, name, state: this.state });
            }
            if (game) {
              await this.$store.dispatch("game/ADD_GAME", game);
              this.$router.replace("/");
            }
          } else {
            // Replace an existing game
            if (!game) {
              // If it hasn't been parsed yet, do it now
              game = new Game({ ptn: this.ptn, name, state: this.state });
            }
            game = await this.$store.dispatch("game/REPLACE_GAME", {
              index,
              ptn: this.ptn,
              gameState: this.state,
            });
            this.$router.replace("/");
          }
        } catch (error) {
          _handleError(error);
          _loadPrevious();
        }
      } else {
        _loadPrevious();
      }
      if (!game) {
        game = this.newGame();
      }
      game.warnings.forEach((warning) => this.notifyWarning(warning));

      if (process.env.DEV) {
        window.main = this;
        window.game = game;
      }
      this.$store.dispatch("game/SET_GAME", game);
    },
    undo() {
      return this.$store.dispatch("game/UNDO");
    },
    redo() {
      return this.$store.dispatch("game/REDO");
    },
    uiShortkey({ srcKey }) {
      if (!this.disabledOptions.includes(srcKey)) {
        this.$store.dispatch("ui/TOGGLE_UI", srcKey);
      }
    },
    dialogShortkey({ srcKey }) {
      switch (srcKey) {
        case "embedGame":
          if (this.$route.name !== "embed") {
            this.$router.push({ name: "embed" });
          } else {
            this.$refs.dialog.$children[0].hide();
          }
          break;
        case "configGIF":
          if (this.$route.name !== "gif") {
            this.$router.push({ name: "gif" });
          } else {
            this.$refs.dialog.$children[0].hide();
          }
          break;
        case "configPNG":
          if (this.$route.name !== "png") {
            this.$router.push({ name: "png" });
          } else {
            this.$refs.dialog.$children[0].hide();
          }
          break;
        case "gameInfo":
          if (this.$route.name === "info-view") {
            this.$refs.dialog.$children[0].hide();
          } else if (this.$route.name === "info-edit") {
            this.$router.replace({ name: "info-view" });
          } else {
            this.$router.push({ name: "info-view" });
          }
          break;
        case "editGame":
          if (this.$route.name === "info-edit") {
            this.$refs.dialog.$children[0].hide();
          } else if (this.$route.name === "info-view") {
            this.$router.replace({ name: "info-edit" });
          } else {
            this.$router.push({ name: "info-edit" });
          }
          break;
        case "editPTN":
          if (this.$route.name !== "edit") {
            this.$router.push({ name: "edit" });
          } else {
            this.$refs.dialog.$children[0].hide();
          }
          break;
        case "help":
          if (this.$route.name !== "help") {
            this.$router.push({
              name: "help",
              params: { section: "usage" },
            });
          } else if (this.$route.params.section !== "usage") {
            this.$router.replace({
              name: "help",
              params: { section: "usage" },
            });
          } else {
            this.$refs.dialog.$children[0].hide();
          }
          break;
        case "account":
          if (this.isAnonymous) {
            if (this.$route.name !== "login") {
              this.$router.push({ name: "login" });
            } else {
              this.$refs.dialog.$children[0].hide();
            }
          } else {
            if (this.$route.name !== "account") {
              this.$router.push({ name: "account" });
            } else {
              this.$refs.dialog.$children[0].hide();
            }
          }
          break;
        case "hotkeys":
          if (this.$route.name !== "help") {
            this.$router.push({
              name: "help",
              params: { section: "hotkeys" },
            });
          } else if (this.$route.params.section !== "hotkeys") {
            this.$router.replace({
              name: "help",
              params: { section: "hotkeys" },
            });
          } else {
            this.$refs.dialog.$children[0].hide();
          }
          break;
        case "loadGame":
          if (this.$route.name !== "add") {
            this.$router.push({
              name: "add",
              params: { tab: "load" },
            });
          } else if (this.$route.params.tab !== "load") {
            this.$router.replace({
              name: "add",
              params: { tab: "load" },
            });
          } else {
            this.$refs.dialog.$children[0].hide();
          }
          break;
        case "loadOnlineGame":
          if (this.$route.name === "load-online") {
            this.$refs.dialog.$children[0].hide();
          } else if (
            this.$route.name === "add" ||
            this.$route.name === "play-online"
          ) {
            this.$router.replace({
              name: "load-online",
            });
          } else {
            this.$router.push({
              name: "load-online",
            });
          }
          break;
        case "newGame":
          if (this.$route.name !== "add") {
            this.$router.push({
              name: "add",
              params: { tab: "new" },
            });
          } else if (this.$route.params.tab !== "new") {
            this.$router.replace({
              name: "add",
              params: { tab: "new" },
            });
          } else {
            this.$refs.dialog.$children[0].hide();
          }
          break;
        case "playOnline":
          if (this.$route.name === "play-online") {
            this.$refs.dialog.$children[0].hide();
          } else if (this.$route.name === "load-online") {
            this.$router.replace({
              name: "play-online",
            });
          } else {
            this.$router.push({
              name: "play-online",
            });
          }
          break;
        case "preferences":
          if (this.$route.name !== "preferences") {
            this.$router.push({ name: "preferences" });
          } else {
            this.$refs.dialog.$children[0].hide();
          }
          break;
        case "theme":
          if (this.$route.name !== "theme") {
            this.$router.push({ name: "theme" });
          } else {
            this.$refs.dialog.$children[0].hide();
          }
          break;
        case "qrCode":
          if (this.$route.name !== "qr") {
            this.$router.push({ name: "qr" });
          } else {
            this.$refs.dialog.$children[0].hide();
          }
          break;
      }
    },
    miscShortkey({ srcKey }) {
      switch (srcKey) {
        case "focusGame":
          this.$refs.gameSelector.$refs.select.showPopup();
          break;
        case "searchGames":
          this.$refs.gameSelector.toggleSearch(true);
          break;
        case "previousGame":
          if (this.$store.state.game.list.length > 1) {
            this.$refs.gameSelector.select(1);
          }
          break;
        case "toggleText":
          let tabs = ["analysis", "notes"];
          if (this.hasChat) {
            tabs.unshift("chat");
          }
          this.textTab = tabs[(tabs.indexOf(this.textTab) + 1) % tabs.length];
          break;
        case "game/IMPORT_FROM_CLIPBOARD":
        case "game/UNDO":
        case "game/REDO":
        case "ui/OPEN":
          this.$store.dispatch(srcKey);
          break;
      }
    },
    addGame() {
      this.$router.push({ name: "add", params: { tab: "load" } });
    },
    account() {
      if (this.isAnonymous) {
        this.$router.push({ name: "login" });
      } else {
        this.$router.push({ name: "account" });
      }
    },
    online() {
      this.$router.push({ name: "load-online" });
    },
    info() {
      this.$router.push({ name: "info-view" });
    },
    edit() {
      if (this.$store.getters["online/canEdit"](this.$game)) {
        this.$router.push({ name: "info-edit" });
      }
    },
    duplicate() {
      this.$store.dispatch("game/ADD_GAME", this.$game);
    },
    share() {
      this.$refs.shareButton.share();
    },
    settings() {
      this.$router.push({ name: "preferences" });
    },
    help() {
      this.$router.push({ name: "help" });
    },
    switchGame(event) {
      if (
        this.$store.state.game.list.length > 1 &&
        !event.currentTarget.classList.contains("q-fab--opened")
      ) {
        this.$refs.gameSelector.select(1);
      }
    },
    showTextTab(value) {
      this.textTab = value;
    },
    openFiles(event) {
      this.nop(event);
      this.$store.dispatch("game/OPEN_FILES", event.dataTransfer.files);
    },
    nop(event) {
      event.stopPropagation();
      event.preventDefault();
    },
  },
  watch: {
    gamesInitialized() {
      this.init();
    },
    user(user, oldUser) {
      if (
        this.isOnline &&
        user &&
        (!oldUser || user.uid !== oldUser.uid) &&
        !this.$game.config.player &&
        this.$game.openPlayer
      ) {
        this.$router.push({ name: "join" });
      }
    },
    hasChat(hasChat) {
      if (!hasChat && this.textTab === "chat") {
        this.textTab = "notes";
      }
    },
  },
  beforeCreate() {
    // Load online functionality
    if (process.env.DEV && this.$store.state.online) {
      this.$store.unregisterModule("online");
    }
    this.$store.registerModule("online", onlineStore);

    // Load analysis functionality
    if (process.env.DEV && this.$store.state.analysis) {
      this.$store.unregisterModule("analysis");
    }
    this.$store.registerModule("analysis", analysisStore);
    this.$store.commit("analysis/SET_BOT", this.$store.state.analysis.botID);

    // Redirect hash URLs
    if (location.hash.length && !this.$q.platform.is.electron) {
      const url = location.hash.substring(1);
      location.hash = "";
      this.$router.replace(url);
      location.reload();
      return;
    }

    // Initialize
    this.$store.dispatch("online/INIT").then(() => {
      if (this.gameID) {
        // Check that the game is not already open
        const index = this.$store.state.game.list.findIndex(
          (game) => game.config.id === this.gameID
        );
        if (index >= 0) {
          this.$store.dispatch("game/SELECT_GAME", index);
        } else {
          // Add online game from URL
          this.$store
            .dispatch("online/LOAD_GAME", this.gameID)
            .then(() => {
              this.$router.replace("/");
            })
            .catch((error) => {
              this.$store.dispatch("ui/NOTIFY_ERROR", error);
            });
        }
      }
    });
  },
  mounted() {
    this.init();

    // Listen for dropped files
    if (window.File && window.FileReader && window.FileList && window.Blob) {
      window.addEventListener("drop", this.openFiles, true);
      window.addEventListener("dragover", this.nop, true);
      window.addEventListener("dragleave", this.nop, true);
    }
  },
  beforeDestroy() {
    window.removeEventListener("drop", this.openFiles);
    window.removeEventListener("dragover", this.nop);
    window.removeEventListener("dragleave", this.nop);
  },
};
</script>

<style lang="scss">
#left-drawer,
#right-drawer {
  .q-drawer {
    background: $panel;
    background: var(--q-color-panel);
    .q-drawer__content {
      overflow: hidden;
    }
  }
}

#right-drawer {
  .q-tabs {
    height: $toolbar-min-height;
  }
  .q-tab-panel {
    padding: 0;
  }
}

.analysis-linear-progress {
  position: absolute;
  top: 0;
  z-index: 1;
}

.toolbar-analysis-toggle {
  top: -32px;
  right: 86px;
  z-index: 1;
}
.toolbar-analysis-height {
  height: 108px;
}
</style>
