<template>
  <small-dialog
    :value="true"
    content-class="ui-settings non-selectable"
    v-bind="$attrs"
  >
    <template v-slot:header>
      <dialog-header icon="settings">{{ $t("Preferences") }}</dialog-header>
    </template>

    <q-list separator>
      <ThemeSelector v-model="themeID" edit-button filled square>
        <template v-slot:prepend>
          <q-icon name="color" />
        </template>
      </ThemeSelector>

      <q-expansion-item icon="board" :label="$t('Board')" group="settings">
        <recess>
          <q-list>
            <q-item>
              <q-item-section>
                {{ $t("Play Speed") }}
                <q-slider
                  v-model="playSpeed"
                  :min="30"
                  :max="160"
                  :label-value="playSpeed + ' ' + $t('BPM')"
                  :step="10"
                  snap
                  label
                />
              </q-item-section>
            </q-item>

            <q-item tag="label" v-ripple>
              <q-item-section>
                <q-item-label>{{ $t("3D Board") }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle v-model="board3D" :disabled="isDisabled('board3D')" />
              </q-item-section>
              <hint v-if="hotkeys.board3D">
                {{ $t("Hotkey") }}: {{ hotkeys.board3D }}
              </hint>
            </q-item>

            <smooth-reflow>
              <q-item v-if="board3D" tag="label" v-ripple>
                <q-item-section>
                  <q-item-label>{{ $t("Orthogonal Board") }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle
                    v-model="orthogonal"
                    :disabled="isDisabled('orthogonal')"
                  />
                </q-item-section>
                <hint v-if="hotkeys.orthogonal">
                  {{ $t("Hotkey") }}: {{ hotkeys.orthogonal }}
                </hint>
              </q-item>

              <q-item v-if="board3D && !orthogonal">
                <q-item-section>
                  {{ $t("Perspective") }}
                  <q-slider
                    v-model="perspective"
                    :min="1"
                    :max="10"
                    :label-value="perspective"
                    snap
                    label
                  />
                </q-item-section>
              </q-item>
            </smooth-reflow>

            <q-item tag="label" v-ripple>
              <q-item-section>
                <q-item-label>{{ $t("Axis Labels") }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="axisLabels"
                  :disabled="isDisabled('axisLabels')"
                />
              </q-item-section>
              <hint v-if="hotkeys.axisLabels">
                {{ $t("Hotkey") }}: {{ hotkeys.axisLabels }}
              </hint>
            </q-item>

            <q-item tag="label" v-ripple>
              <q-item-section>
                <q-item-label>{{ $t("Road Connections") }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="showRoads"
                  :disabled="isDisabled('showRoads')"
                />
              </q-item-section>
              <hint v-if="hotkeys.showRoads">
                {{ $t("Hotkey") }}: {{ hotkeys.showRoads }}
              </hint>
            </q-item>

            <q-item tag="label" v-ripple>
              <q-item-section>
                <q-item-label>{{ $t("Turn Indicator") }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="turnIndicator"
                  :disabled="isDisabled('turnIndicator')"
                />
              </q-item-section>
              <hint v-if="hotkeys.turnIndicator">
                {{ $t("Hotkey") }}: {{ hotkeys.turnIndicator }}
              </hint>
            </q-item>

            <smooth-reflow>
              <q-item v-if="turnIndicator" tag="label" v-ripple>
                <q-item-section>
                  <q-item-label>{{ $t("Flat Counts") }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle
                    v-model="flatCounts"
                    :disabled="isDisabled('flatCounts')"
                  />
                </q-item-section>
              </q-item>
              <hint v-if="hotkeys.flatCounts">
                {{ $t("Hotkey") }}: {{ hotkeys.flatCounts }}
              </hint>
            </smooth-reflow>

            <q-item tag="label" v-ripple>
              <q-item-section>
                <q-item-label>{{ $t("Highlight Squares") }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="highlightSquares"
                  :disabled="isDisabled('highlightSquares')"
                />
              </q-item-section>
              <hint v-if="hotkeys.highlightSquares">
                {{ $t("Hotkey") }}: {{ hotkeys.highlightSquares }}
              </hint>
            </q-item>

            <q-item tag="label" v-ripple>
              <q-item-section>
                <q-item-label>{{ $t("Piece Shadows") }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="pieceShadows"
                  :disabled="isDisabled('pieceShadows')"
                />
              </q-item-section>
              <hint v-if="hotkeys.pieceShadows">
                {{ $t("Hotkey") }}: {{ hotkeys.pieceShadows }}
              </hint>
            </q-item>

            <q-item tag="label" v-ripple>
              <q-item-section>
                <q-item-label>{{ $t("Unplayed Pieces") }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="unplayedPieces"
                  :disabled="isDisabled('unplayedPieces')"
                />
              </q-item-section>
              <hint v-if="hotkeys.unplayedPieces">
                {{ $t("Hotkey") }}: {{ hotkeys.unplayedPieces }}
              </hint>
            </q-item>

            <q-item tag="label" v-ripple>
              <q-item-section>
                <q-item-label>{{ $t("Current Move") }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="showMove"
                  :disabled="isDisabled('showMove')"
                />
              </q-item-section>
              <hint v-if="hotkeys.showMove">
                {{ $t("Hotkey") }}: {{ hotkeys.showMove }}
              </hint>
            </q-item>
          </q-list>
        </recess>
      </q-expansion-item>

      <q-expansion-item icon="ui" :label="$t('UI')" group="settings">
        <recess>
          <q-list>
            <q-select
              :label="$t('Duplicate Game Names')"
              v-model="openDuplicate"
              :options="openDuplicateOptions"
              behavior="menu"
              transition-show="none"
              transition-hide="none"
              item-aligned
              map-options
              emit-value
              filled
            />

            <q-item tag="label" v-ripple>
              <q-item-section>
                <q-item-label>{{ $t("Show UI Hints") }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="showHints"
                  :disabled="isDisabled('showHints')"
                />
              </q-item-section>
              <hint v-if="hotkeys.showHints">
                {{ $t("Hotkey") }}: {{ hotkeys.showHints }}
              </hint>
            </q-item>

            <q-item tag="label" v-ripple>
              <q-item-section>
                <q-item-label>{{ $t("Native Sharing") }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="nativeSharing"
                  :disabled="isDisabled('nativeSharing')"
                />
              </q-item-section>
              <hint v-if="hotkeys.nativeSharing">
                {{ $t("Hotkey") }}: {{ hotkeys.nativeSharing }}
              </hint>
            </q-item>

            <q-item tag="label" v-ripple>
              <q-item-section>
                <q-item-label>{{ $t("Animate Board") }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="animateBoard"
                  :disabled="isDisabled('animateBoard')"
                />
              </q-item-section>
              <hint v-if="hotkeys.animateBoard">
                {{ $t("Hotkey") }}: {{ hotkeys.animateBoard }}
              </hint>
            </q-item>

            <smooth-reflow>
              <q-item v-if="animateBoard" tag="label" v-ripple>
                <q-item-section>
                  <q-item-label>{{
                    $t("Animate while scrubbing")
                  }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle
                    v-model="animateScrub"
                    :disabled="isDisabled('animateScrub')"
                  />
                </q-item-section>
                <hint v-if="hotkeys.animateScrub">
                  {{ $t("Hotkey") }}: {{ hotkeys.animateScrub }}
                </hint>
              </q-item>
            </smooth-reflow>

            <q-item tag="label" v-ripple>
              <q-item-section>
                <q-item-label>{{ $t("Show All Branches") }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="showAllBranches"
                  :disabled="isDisabled('showAllBranches')"
                />
              </q-item-section>
              <hint v-if="hotkeys.showAllBranches">
                {{ $t("Hotkey") }}: {{ hotkeys.showAllBranches }}
              </hint>
            </q-item>

            <q-item tag="label" v-ripple>
              <q-item-section>
                <q-item-label>{{ $t("Game Notifications") }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="notifyGame"
                  :disabled="isDisabled('notifyGame')"
                />
              </q-item-section>
              <hint v-if="hotkeys.notifyGame">
                {{ $t("Hotkey") }}: {{ hotkeys.notifyGame }}
              </hint>
            </q-item>

            <q-item tag="label" v-ripple>
              <q-item-section>
                <q-item-label>{{ $t("Note Notifications") }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="notifyNotes"
                  :disabled="isDisabled('notifyNotes')"
                />
              </q-item-section>
              <hint v-if="hotkeys.notifyNotes">
                {{ $t("Hotkey") }}: {{ hotkeys.notifyNotes }}
              </hint>
            </q-item>

            <q-item tag="label" v-ripple>
              <q-item-section>
                <q-item-label>{{ $t("Play Controls") }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="showControls"
                  :disabled="isDisabled('showControls')"
                />
              </q-item-section>
              <hint v-if="hotkeys.showControls">
                {{ $t("Hotkey") }}: {{ hotkeys.showControls }}
              </hint>
            </q-item>

            <q-item tag="label" v-ripple>
              <q-item-section>
                <q-item-label>{{ $t("Scrub Bar") }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="showScrubber"
                  :disabled="isDisabled('showScrubber')"
                />
              </q-item-section>
              <hint v-if="hotkeys.showScrubber">
                {{ $t("Hotkey") }}: {{ hotkeys.showScrubber }}
              </hint>
            </q-item>

            <q-item tag="label" v-ripple>
              <q-item-section>
                <q-item-label>{{ $t("Scrub with scroll wheel") }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="scrollScrubbing"
                  :disabled="isDisabled('scrollScrubbing')"
                />
              </q-item-section>
              <hint v-if="hotkeys.scrollScrubbing">
                {{ $t("Hotkey") }}: {{ hotkeys.scrollScrubbing }}
              </hint>
            </q-item>
          </q-list>
        </recess>
      </q-expansion-item>
    </q-list>

    <template v-slot:footer>
      <q-separator />
      <q-card-actions align="right">
        <q-btn :label="$t('Close')" color="primary" flat v-close-popup />
      </q-card-actions>
    </template>
  </small-dialog>
</template>

<script>
import ThemeSelector from "../components/controls/ThemeSelector";

import { zipObject } from "lodash";
import { HOTKEYS_FORMATTED } from "../keymap";

const props = [
  "animateBoard",
  "animateScrub",
  "axisLabels",
  "board3D",
  "flatCounts",
  "highlightSquares",
  "nativeSharing",
  "notifyGame",
  "notifyNotes",
  "openDuplicate",
  "orthogonal",
  "perspective",
  "pieceShadows",
  "playSpeed",
  "scrollScrubbing",
  "showAllBranches",
  "showControls",
  "showHints",
  "showMove",
  "showRoads",
  "showScrubber",
  "themeID",
  "turnIndicator",
  "unplayedPieces",
];

export default {
  name: "Preferences",
  components: { ThemeSelector },
  data() {
    return {
      hotkeys: HOTKEYS_FORMATTED.UI,
      openDuplicateOptions: [
        { label: this.$t("Rename"), value: "rename" },
        { label: this.$t("Replace"), value: "replace" },
      ],
    };
  },
  computed: {
    game() {
      return this.$game;
    },
    disabled() {
      return this.$store.getters["game/disabledOptions"];
    },
    ...zipObject(
      props,
      props.map((key) => ({
        get() {
          return this.isDisabled(key) ? false : this.$store.state.ui[key];
        },
        set(value) {
          this.$store.dispatch("ui/SET_UI", [key, value]);
        },
      }))
    ),
  },
  methods: {
    isDisabled(key) {
      return this.disabled && this.disabled.includes(key);
    },
  },
  watch: {
    theme(theme) {
      this.$store.dispatch("ui/SET_THEME", theme);
    },
  },
};
</script>
