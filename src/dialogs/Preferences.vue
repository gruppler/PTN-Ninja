<template>
  <small-dialog
    :value="true"
    content-class="ui-settings non-selectable"
    v-bind="$attrs"
  >
    <template v-slot:header>
      <dialog-header icon="settings">{{ $t("UI Preferences") }}</dialog-header>
    </template>

    <q-list>
      <ThemeSelector v-model="themeID" edit-button filled item-aligned>
        <template v-slot:prepend>
          <q-icon name="color" />
        </template>
      </ThemeSelector>

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
          <q-item-label>{{ $t("UI Hints") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle v-model="showHints" :disabled="isDisabled('showHints')" />
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
            <q-item-label>{{ $t("Animate while scrubbing") }}</q-item-label>
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
          <q-item-label>{{ $t("Current Move") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle v-model="showMove" :disabled="isDisabled('showMove')" />
        </q-item-section>
        <hint v-if="hotkeys.showMove">
          {{ $t("Hotkey") }}: {{ hotkeys.showMove }}
        </hint>
      </q-item>

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
          <q-toggle v-model="notifyGame" :disabled="isDisabled('notifyGame')" />
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

      <smooth-reflow>
        <q-item v-if="showControls" tag="label" v-ripple>
          <q-item-section>
            <q-item-label>{{ $t("Play Button") }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-toggle
              v-model="showPlayButton"
              :disabled="isDisabled('showPlayButton')"
            />
          </q-item-section>
          <hint v-if="hotkeys.showPlayButton">
            {{ $t("Hotkey") }}: {{ hotkeys.showPlayButton }}
          </hint>
        </q-item>

        <q-item v-if="showControls && showPlayButton">
          <q-item-section>
            {{ $t("Play Speed") }}
            <q-slider
              v-model="playSpeed"
              :min="30"
              :max="160"
              :label-value="playSpeed + ' ' + $t('FPM')"
              :step="10"
              snap
              label
            />
          </q-item-section>
        </q-item>
      </smooth-reflow>

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

      <smooth-reflow>
        <q-item v-if="scrollScrubbing">
          <q-item-section>
            <q-item-label class="text-no-wrap">
              {{ $t("Scroll threshold") }}
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-input
              v-model="scrollThreshold"
              type="number"
              :min="0"
              :max="999"
              suffix="px"
              clearable
              filled
              dense
            >
              <template v-slot:before>
                <q-btn
                  @click="dialogAutodetect = true"
                  icon="autofix"
                  flat
                  dense
                >
                  <hint>{{ $t("Autodetect") }}</hint>
                </q-btn>
              </template>
            </q-input>
          </q-item-section>
        </q-item>
      </smooth-reflow>
    </q-list>

    <template v-slot:footer>
      <q-separator />
      <q-card-actions align="right">
        <q-btn :label="$t('Close')" color="primary" flat v-close-popup />
      </q-card-actions>
    </template>

    <q-dialog @wheel="autodetect" v-model="dialogAutodetect">
      <q-card class="non-selectable">
        <q-card-section class="q-py-xl">
          {{ $t("hint.autodetectScroll") }}
        </q-card-section>
      </q-card>
    </q-dialog>
  </small-dialog>
</template>

<script>
import ThemeSelector from "../components/controls/ThemeSelector";

import { zipObject } from "lodash";
import { HOTKEYS_FORMATTED } from "../keymap";

const props = [
  "animateBoard",
  "animateScrub",
  "nativeSharing",
  "notifyGame",
  "notifyNotes",
  "openDuplicate",
  "playSpeed",
  "scrollScrubbing",
  "scrollThreshold",
  "showAllBranches",
  "showControls",
  "showPlayButton",
  "showHints",
  "showMove",
  "showScrubber",
  "themeID",
];

export default {
  name: "Preferences",
  components: { ThemeSelector },
  data() {
    return {
      hotkeys: HOTKEYS_FORMATTED.UI,
      dialogAutodetect: false,
      openDuplicateOptions: [
        { label: this.$t("Rename"), value: "rename" },
        { label: this.$t("Replace"), value: "replace" },
      ],
    };
  },
  computed: {
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
    autodetect(event) {
      this.scrollThreshold = Math.abs(event.deltaY);
      this.dialogAutodetect = false;
    },
  },
  watch: {
    scrollThreshold(value) {
      if (!value || value < 1) {
        this.scrollThreshold = 0;
      }
    },
  },
};
</script>
