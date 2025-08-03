<template>
  <q-layout v-if="gameExists" class="non-selectable" :view="viewLayout">
    <q-header v-if="$store.state.ui.showHeader" elevated class="bg-ui">
      <q-toolbar class="q-pa-none">
        <q-btn
          v-if="!$store.state.ui.disablePTN"
          icon="moves"
          @click="showPTN = !showPTN"
          :color="showPTN ? 'primary' : ''"
          stretch
          flat
        >
          <hint>{{ $t(showPTN ? "Hide PTN" : "Show PTN") }}</hint>
        </q-btn>
        <q-toolbar-title
          id="title"
          class="ellipsis-2-lines"
          :class="{ 'q-ml-md': $store.state.ui.disablePTN }"
        >
          {{ title }}
        </q-toolbar-title>
        <q-btn icon="info" @click.prevent="info" stretch flat>
          <hint>{{ $t("View Game Info") }}</hint>
        </q-btn>
        <q-btn icon="open_in_new" @click.prevent="openLink" stretch flat>
          <hint>{{ $t("app_title") }}</hint>
        </q-btn>
        <q-btn
          v-if="!$store.state.ui.disableText"
          :icon="notifyNotes ? 'notes' : 'notes_off'"
          @click.left="showText = !showText"
          @click.right.prevent="notifyNotes = !notifyNotes"
          :color="showText ? 'primary' : ''"
          stretch
          flat
        >
          <hint>{{ $t(showText ? "Hide Notes" : "Show Notes") }}</hint>
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
        <Board
          ref="board"
          :hide-names="!showNames"
          v-shortkey="hotkeys.MISC"
          @shortkey="miscShortkey"
        />
        <BoardToggles v-if="!isDialogShowing" />
        <q-page-sticky position="bottom" :offset="[0, 0]">
          <CurrentMove v-if="!$store.state.ui.disablePTN" />
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
      v-if="!$store.state.ui.disablePTN"
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
        <PTN-Tools v-if="!$store.state.ui.disablePTNTools" ref="tools">
          <ShareButton flat stretch no-menu />
        </PTN-Tools>
        <div class="col-grow relative-position">
          <PTN
            class="absolute-fit"
            :recess="!$store.state.ui.disablePTNTools"
          />
        </div>
        <q-toolbar
          v-if="
            (!$store.state.ui.disableUndo &&
              !$store.state.ui.disableNavigation) ||
            !$store.state.ui.disablePTNTools
          "
          class="footer-toolbar bg-ui q-pa-none"
        >
          <UndoButtons
            v-if="
              !$store.state.ui.disableUndo && !$store.state.ui.disableNavigation
            "
            :class="{ 'full-width': $store.state.ui.disablePTNTools }"
            spread
            stretch
            flat
            unelevated
          />
          <EvalButtons
            v-if="!$store.state.ui.disablePTNTools"
            class="full-width"
            spread
            stretch
            flat
            unelevated
          />
        </q-toolbar>
      </div>
      <div class="gt-xs absolute-fit inset-shadow no-pointer-events" />
    </q-drawer>

    <q-drawer
      v-if="!$store.state.ui.disableText"
      id="right-drawer"
      v-model="showText"
      side="right"
      :width="panelWidth"
      :breakpoint="showPTN ? doubleWidth : singleWidth"
      :no-swipe-open="!Platform.is.mobile"
      :no-swipe-close="!Platform.is.mobile"
      persistent
    >
      <Notes ref="notes" class="fit" />
    </q-drawer>

    <q-footer class="bg-panel">
      <ToolbarAnalysis v-if="hasAnalysis" :analysis="currentAnalysis" />

      <div class="relative-position">
        <Scrubber v-if="!$store.state.ui.disableNavigation" />

        <q-toolbar
          v-if="!$store.state.ui.disableNavigation"
          v-show="$store.state.ui.showControls"
          class="footer-toolbar bg-ui"
        >
          <NavControls ref="playControls" />
        </q-toolbar>
      </div>
    </q-footer>

    <router-view ref="dialog" go-back no-route-dismiss />

    <ErrorNotifications :errors="errors" />
    <GameNotifications ref="gameNotifications" />
    <NoteNotifications ref="noteNotifications" />
  </q-layout>
  <q-dialog v-else :value="true"> No Game </q-dialog>
</template>

<script>
// Essentials:
import Board from "../components/board/Board";
import CurrentMove from "../components/board/CurrentMove";
import PTN from "../components/drawers/PTN";
import Notes from "../components/drawers/Notes";

// Notifications:
import ErrorNotifications from "../components/notify/ErrorNotifications";
import GameNotifications from "../components/notify/GameNotifications";
import NoteNotifications from "../components/notify/NoteNotifications";

// Controls:
import NavControls from "../components/controls/NavControls";
import Scrubber from "../components/controls/Scrubber";
import PTNTools from "../components/controls/PTNTools";
import UndoButtons from "../components/controls/UndoButtons";
import EvalButtons from "../components/controls/EvalButtons";
import BoardToggles from "../components/controls/BoardToggles";
import ShareButton from "../components/controls/ShareButton";
import ToolbarAnalysis from "../components/board/ToolbarAnalysis";

import Game from "../Game";
import { HOTKEYS } from "../keymap";

import { Platform } from "quasar";
import { forEach, isEqual } from "lodash";

export default {
  name: "EmbedLayout",
  components: {
    Board,
    CurrentMove,
    PTN,
    Notes,
    ErrorNotifications,
    GameNotifications,
    NoteNotifications,
    NavControls,
    Scrubber,
    PTNTools,
    UndoButtons,
    EvalButtons,
    BoardToggles,
    ShareButton,
    ToolbarAnalysis,
  },
  props: ["ptn", "name", "state"],
  data() {
    return {
      Platform,
      errors: [],
      hotkeys: HOTKEYS,
      title: "",
      defaults: { ...this.$store.state.ui.embedConfig.ui },
      doubleWidth: 1025,
      singleWidth: this.$q.screen.sizes.sm,
      showNames: true,
    };
  },
  computed: {
    viewLayout() {
      return this.$store.state.ui.disablePTNTools
        ? "hHh LpR lFr"
        : "lHh LpR lFr";
    },
    gameExists() {
      return Boolean(this.$store.state.game.name);
    },
    hasAnalysis() {
      return (
        Object.keys(this.$store.state.game.analyzedPositions).length > 0 ||
        Object.keys(this.$store.state.game.comments.evaluations).length > 0 ||
        Object.keys(this.$store.state.game.comments.pvs).length > 0
      );
    },
    currentAnalysis() {
      return (
        this.$store.state.game.analyzedPositions[
          this.$store.state.game.position.tps
        ] || null
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
    notifyNotes: {
      get() {
        return this.$store.state.ui.notifyNotes;
      },
      set(value) {
        this.$store.dispatch("ui/SET_UI", ["notifyNotes", value]);
      },
    },
    disabledOptions() {
      return this.$store.getters["game/disabledOptions"];
    },
    isDialogShowing() {
      return !["local", "game"].includes(this.$route.name);
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
    getGame() {
      if (!this.ptn) {
        this.$store.dispatch(
          "game/SET_GAME",
          new Game({ tags: { size: this.$store.state.ui.size } })
        );
        return;
      }
      let game;
      try {
        game = new Game({
          ptn: this.ptn,
          name: this.name,
          state: this.state,
        });
      } catch (error) {
        const name = game ? game.name : "";
        if (game && name) {
          game.name = name;
        }
        console.error(error);
        this.errors.push(this.$t(`error["${error.message}"]`));
      }
      this.$store.dispatch("game/SET_GAME", game);
      this.$router.replace("/");
    },
    clickNotification(event) {
      if (
        event.target.matches(".q-notification.note") ||
        event.target.matches(".q-notification.note .q-notification__message")
      ) {
        this.showText = true;
      } else if (
        event.target.matches(".q-notification.game") ||
        event.target.matches(".q-notification.game .q-notification__message")
      ) {
        this.$refs.gameNotifications.$refs.notifications.hide();
      }
    },
    info() {
      this.$router.push({ name: "info-view" });
    },
    openLink() {
      window.open(
        this.$store.getters["ui/url"](this.$game, {
          name: this.$game.name,
          origin: true,
          state: true,
        }),
        "_blank"
      );
    },
    undo() {
      return $store.dispatch("game/UNDO");
    },
    redo() {
      return $store.dispatch("game/REDO");
    },
    uiShortkey({ srcKey }) {
      if (!this.disabledOptions.includes(srcKey)) {
        this.$store.dispatch("ui/TOGGLE_UI", srcKey);
      }
    },
    dialogShortkey({ srcKey }) {
      switch (srcKey) {
        case "gameInfo":
          if (this.$store.state.ui.showHeader) {
            if (this.$route.name !== "info-view") {
              this.$router.push({ name: "info-view" });
            } else {
              this.$refs.dialog.$children[0].hide();
            }
          }
          break;
        case "editPTN":
          if (!this.$store.state.ui.disablePTN) {
            if (this.$route.name !== "edit") {
              this.$router.push({ name: "edit" });
            } else {
              this.$refs.dialog.$children[0].hide();
            }
          }
          break;
      }
    },
    miscShortkey({ srcKey }) {
      switch (srcKey) {
        case "game/UNDO":
        case "game/REDO":
          if (!this.$store.state.ui.disableNavigation) {
            this.$store.dispatch(srcKey);
          }
          break;
      }
    },
  },
  beforeCreate() {
    if (location.hash.length) {
      const url = location.hash.substring(1);
      location.hash = "";
      this.$router.replace(url);
      location.reload();
    }
  },
  created() {
    this.$store.commit("ui/SET_EMBED_GAME");
    forEach(this.state, (value, key) => {
      if (!isEqual(value, this.$store.state[key])) {
        this.$store.commit("ui/SET_UI", [key, value]);
      }
    });
    this.$store.dispatch("ui/SET_THEME", this.$store.state.ui.theme);
    this.getGame();
    this.title = this.name || this.$game.generateName();
  },
  mounted() {
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
  },
};
</script>

<style lang="scss">
#left-drawer,
#right-drawer {
  .q-drawer {
    background: var(--q-color-panel);
    .q-drawer__content {
      overflow: hidden;
    }
  }
}

@media (max-width: $breakpoint-xs-max) {
  #title {
    font-size: 1.2em;
    white-space: normal;
    line-height: 1.25em;
  }
}
</style>
