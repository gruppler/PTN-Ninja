<template>
  <q-page-sticky :position="position" :offset="offset">
    <div
      :class="[
        'board-toggles',
        'q-gutter-sm',
        toggleLayout === 'column' ? 'q-pt-sm column' : 'q-pl-sm row',
      ]"
    >
      <FullscreenToggle
        @contextmenu.prevent
        :target="fullscreenTarget"
        class="dimmed-btn"
        v-ripple="false"
        :color="fg"
        :size="size"
        flat
        round
      />

      <q-btn
        v-if="!isEmbedded || $store.state.ui.showBoardPrefsBtn"
        @contextmenu.prevent
        icon="settings"
        class="dimmed-btn board-prefs-btn"
        v-ripple="false"
        :color="fg"
        :size="size"
        flat
        round
      >
        <hint>{{ $t("Board Preferences") }}</hint>

        <q-menu transition-show="none" transition-hide="none" square>
          <q-list class="board-menu">
            <setting-row :entry="themeEntry" />

            <settings-section
              v-for="s in sections"
              :key="s.key"
              :category="s.category"
              :section="s.section"
              :ids="s.ids"
              :title="s.title && $t(s.title)"
              :open="Boolean(boardMenuSections[s.key])"
              @update:open="setSectionOpen(s.key, $event)"
              collapsible
            />

            <template v-if="!isEmbedded">
              <q-separator />
              <settings-link category="board" />
            </template>
          </q-list>
        </q-menu>
      </q-btn>

      <q-btn
        v-if="!isEmbedded || $store.state.ui.showBoardTransformBtn"
        @contextmenu.prevent="resetTransform"
        direction="down"
        icon="rotate_180"
        class="dimmed-btn"
        v-ripple="false"
        :color="fg"
        :size="size"
        flat
        round
        v-shortkey="hotkeys.TRANSFORMS"
        @shortkey="transformHotkey"
      >
        <hint>{{ $t("Transform Board") }}</hint>

        <q-menu transition-show="none" transition-hide="none" auto-close square>
          <q-list>
            <q-item @click="rotate180" clickable v-ripple>
              <q-item-section side>
                <q-icon name="rotate_180" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ $t("Rotate 180") }}</q-item-label>
              </q-item-section>
              <hint v-if="hotkeys.TRANSFORMS.rotate180">
                {{ $t("Hotkey") }}: {{ hotkeysFormatted.TRANSFORMS.rotate180 }}
              </hint>
            </q-item>
            <q-item @click="rotateLeft" clickable v-ripple>
              <q-item-section side>
                <q-icon name="rotate_left" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ $t("Rotate Left") }}</q-item-label>
              </q-item-section>
              <hint v-if="hotkeys.TRANSFORMS.rotateLeft">
                {{ $t("Hotkey") }}: {{ hotkeysFormatted.TRANSFORMS.rotateLeft }}
              </hint>
            </q-item>
            <q-item @click="rotateRight" clickable v-ripple>
              <q-item-section side>
                <q-icon name="rotate_right" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ $t("Rotate Right") }}</q-item-label>
              </q-item-section>
              <hint v-if="hotkeys.TRANSFORMS.rotateRight">
                {{ $t("Hotkey") }}:
                {{ hotkeysFormatted.TRANSFORMS.rotateRight }}
              </hint>
            </q-item>
            <q-item @click="flipHorizontal" clickable v-ripple>
              <q-item-section side>
                <q-icon name="flip_horizontal" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ $t("Flip Horizontally") }}</q-item-label>
              </q-item-section>
              <hint v-if="hotkeys.TRANSFORMS.flipHorizontal">
                {{ $t("Hotkey") }}:
                {{ hotkeysFormatted.TRANSFORMS.flipHorizontal }}
              </hint>
            </q-item>
            <q-item @click="flipVertical" clickable v-ripple>
              <q-item-section side>
                <q-icon name="flip_vertical" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ $t("Flip Vertically") }}</q-item-label>
              </q-item-section>
              <hint v-if="hotkeys.TRANSFORMS.flipVertical">
                {{ $t("Hotkey") }}:
                {{ hotkeysFormatted.TRANSFORMS.flipVertical }}
              </hint>
            </q-item>
            <q-separator />
            <q-item
              @click="resetTransform"
              :disable="!isTransformed"
              clickable
              v-ripple
            >
              <q-item-section side>
                <q-icon name="close" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ $t("Reset") }}</q-item-label>
              </q-item-section>
              <hint v-if="hotkeys.TRANSFORMS.resetTransform">
                {{ $t("Hotkey") }}:
                {{ hotkeysFormatted.TRANSFORMS.resetTransform }}
              </hint>
            </q-item>
            <q-item
              @click="applyTransform"
              :disable="!isTransformed"
              clickable
              v-ripple
            >
              <q-item-section side>
                <q-icon name="apply" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ $t("Apply") }}</q-item-label>
              </q-item-section>
              <hint v-if="hotkeys.TRANSFORMS.applyTransform">
                {{ $t("Hotkey") }}:
                {{ hotkeysFormatted.TRANSFORMS.applyTransform }}
              </hint>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>

      <q-btn
        v-if="!isEmbedded"
        @contextmenu.prevent
        @click="toggleHighlighter"
        @shortkey="toggleHighlighter"
        v-shortkey="hotkeys.HIGHLIGHTER.toggle"
        icon="highlighter"
        :class="{ 'dimmed-btn': !highlighterEnabled }"
        v-ripple="false"
        :color="highlighterEnabled ? '' : fg"
        :style="{ color: highlighterEnabled ? highlighterColor : '' }"
        :size="size"
        flat
        round
      >
        <hint>
          {{ $t("Toggle Highlighter") }}
          <div v-if="hotkeys.TRANSFORMS.applyTransform">
            {{ $t("Hotkey") }}:
            {{ hotkeysFormatted.HIGHLIGHTER.toggle }}
          </div>
        </hint>
      </q-btn>
    </div>
  </q-page-sticky>
</template>

<script>
import FullscreenToggle from "./FullscreenToggle";
import SettingsLink from "../settings/SettingsLink";

import { HOTKEYS, HOTKEYS_FORMATTED } from "../../keymap";
import { byId } from "../../settings/registry";

// The board menu's sections, in order
const SECTIONS = [
  { key: "onBoard", category: "board", section: "onBoard" },
  { key: "aroundBoard", category: "board", section: "aroundBoard" },
  {
    key: "analysis",
    category: "analysis",
    section: "onBoard",
    ids: ["action:analysisVisuals", "ui:showAnalysisBoard", "ui:showEval"],
    title: "settings.categories.analysis",
  },
  { key: "view", category: "board", section: "view" },
];

export default {
  name: "BoardToggles",
  components: { FullscreenToggle, SettingsLink },
  props: ["fullscreenTarget"],
  data() {
    return {
      hotkeys: HOTKEYS,
      hotkeysFormatted: HOTKEYS_FORMATTED,
      sections: SECTIONS,
      themeEntry: byId("ui:themeID"),
    };
  },
  computed: {
    isEmbedded() {
      return this.$store.state.ui.embed;
    },
    highlighterEnabled: {
      get() {
        return this.$store.state.game.highlighterEnabled;
      },
      set(value) {
        this.$store.dispatch("game/SET_HIGHLIGHTER_ENABLED", value);
      },
    },
    highlighterColor() {
      return (
        this.$store.state.ui.highlighterColor ||
        this.$store.state.ui.theme.colors.primary
      );
    },
    boardMenuSections() {
      return this.$store.state.ui.boardMenuSections;
    },
    fg() {
      return this.$store.state.ui.theme.secondaryDark
        ? "textLight"
        : "textDark";
    },
    size() {
      return this.$store.state.ui.isSmallToggles ? "sm" : "md";
    },
    toggleLayout() {
      return this.$store.state.ui.toggleLayout;
    },
    position() {
      return "top-left";
    },
    offset() {
      return [0, 0];
    },
    boardTransform() {
      return this.$store.state.ui.boardTransform;
    },
    isTransformed() {
      return Boolean(this.boardTransform[0] || this.boardTransform[1]);
    },
  },
  methods: {
    setSectionOpen(key, open) {
      this.$store.dispatch("ui/SET_UI", [
        "boardMenuSections",
        { ...this.boardMenuSections, [key]: open },
      ]);
    },
    resetTransform() {
      this.$store.dispatch("ui/RESET_TRANSFORM");
    },
    applyTransform() {
      this.$store.dispatch("game/APPLY_TRANSFORM", this.boardTransform);
    },
    rotate180() {
      this.$store.dispatch("ui/ROTATE_180");
    },
    rotateLeft() {
      this.$store.dispatch("ui/ROTATE_LEFT");
    },
    rotateRight() {
      this.$store.dispatch("ui/ROTATE_RIGHT");
    },
    flipHorizontal() {
      this.$store.dispatch("ui/FLIP_HORIZONTAL");
    },
    flipVertical() {
      this.$store.dispatch("ui/FLIP_VERTICAL");
    },
    transformHotkey({ srcKey }) {
      this[srcKey]();
    },
    toggleHighlighter() {
      this.highlighterEnabled = !this.highlighterEnabled;
    },
  },
};
</script>
