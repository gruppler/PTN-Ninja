<template>
  <q-dialog
    :value="value"
    @input="$emit('input', $event)"
    content-class="ui-settings non-selectable"
    v-bind="$attrs"
  >
    <q-card style="width: 300px" class="bg-secondary">
      <dialog-header>{{ $t("Preferences") }}</dialog-header>

      <q-separator />

      <q-list separator>
        <q-expansion-item
          icon="apps"
          :label="$t('Board')"
          group="settings"
          default-opened
        >
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
                    color="accent"
                    snap
                    label
                  />
                </q-item-section>
              </q-item>

              <q-item tag="label" :title="hotkeys.animateBoard" v-ripple>
                <q-item-section>
                  <q-item-label>{{ $t("Animate Board") }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle
                    color="accent"
                    v-model="animateBoard"
                    :disabled="isDisabled('animateBoard')"
                  />
                </q-item-section>
              </q-item>

              <q-item tag="label" :title="hotkeys.axisLabels" v-ripple>
                <q-item-section>
                  <q-item-label>{{ $t("Axis Labels") }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle
                    color="accent"
                    v-model="axisLabels"
                    :disabled="isDisabled('axisLabels')"
                  />
                </q-item-section>
              </q-item>

              <q-item tag="label" :title="hotkeys.board3D" v-ripple>
                <q-item-section>
                  <q-item-label>{{ $t("3D Board") }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle
                    color="accent"
                    v-model="board3D"
                    :disabled="isDisabled('board3D')"
                  />
                </q-item-section>
              </q-item>

              <q-item tag="label" :title="hotkeys.showRoads" v-ripple>
                <q-item-section>
                  <q-item-label>{{ $t("Road Connections") }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle
                    color="accent"
                    v-model="showRoads"
                    :disabled="isDisabled('showRoads')"
                  />
                </q-item-section>
              </q-item>

              <q-item tag="label" :title="hotkeys.highlightSquares" v-ripple>
                <q-item-section>
                  <q-item-label>{{ $t("Highlight Squares") }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle
                    color="accent"
                    v-model="highlightSquares"
                    :disabled="isDisabled('highlightSquares')"
                  />
                </q-item-section>
              </q-item>

              <q-item tag="label" :title="hotkeys.pieceShadows" v-ripple>
                <q-item-section>
                  <q-item-label>{{ $t("Piece Shadows") }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle
                    color="accent"
                    v-model="pieceShadows"
                    :disabled="isDisabled('pieceShadows')"
                  />
                </q-item-section>
              </q-item>

              <q-item tag="label" :title="hotkeys.flatCounts" v-ripple>
                <q-item-section>
                  <q-item-label>{{ $t("Flat Counts") }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle
                    color="accent"
                    v-model="flatCounts"
                    :disabled="isDisabled('flatCounts')"
                  />
                </q-item-section>
              </q-item>

              <q-item tag="label" :title="hotkeys.unplayedPieces" v-ripple>
                <q-item-section>
                  <q-item-label>{{ $t("Unplayed Pieces") }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle
                    color="accent"
                    v-model="unplayedPieces"
                    :disabled="isDisabled('unplayedPieces')"
                  />
                </q-item-section>
              </q-item>

              <q-item tag="label" :title="hotkeys.showMove" v-ripple>
                <q-item-section>
                  <q-item-label>{{ $t("Current Move") }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle
                    color="accent"
                    v-model="showMove"
                    :disabled="isDisabled('showMove')"
                  />
                </q-item-section>
              </q-item>
            </q-list>
          </recess>
        </q-expansion-item>

        <q-expansion-item icon="settings" :label="$t('UI')" group="settings">
          <recess>
            <q-list>
              <q-item tag="label" :title="hotkeys.showAllBranches" v-ripple>
                <q-item-section>
                  <q-item-label>{{ $t("Show All Branches") }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle
                    color="accent"
                    v-model="showAllBranches"
                    :disabled="isDisabled('showAllBranches')"
                  />
                </q-item-section>
              </q-item>

              <q-item tag="label" :title="hotkeys.notifyGame" v-ripple>
                <q-item-section>
                  <q-item-label>{{ $t("Game Notifications") }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle
                    color="accent"
                    v-model="notifyGame"
                    :disabled="isDisabled('notifyGame')"
                  />
                </q-item-section>
              </q-item>

              <q-item tag="label" :title="hotkeys.notifyNotes" v-ripple>
                <q-item-section>
                  <q-item-label>{{ $t("Note Notifications") }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle
                    color="accent"
                    v-model="notifyNotes"
                    :disabled="isDisabled('notifyNotes')"
                  />
                </q-item-section>
              </q-item>

              <q-item tag="label" :title="hotkeys.showControls" v-ripple>
                <q-item-section>
                  <q-item-label>{{ $t("Play Controls") }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle
                    color="accent"
                    v-model="showControls"
                    :disabled="isDisabled('showControls')"
                  />
                </q-item-section>
              </q-item>

              <q-item tag="label" :title="hotkeys.showScrubber" v-ripple>
                <q-item-section>
                  <q-item-label>{{ $t("Scrub Bar") }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle
                    color="accent"
                    v-model="showScrubber"
                    :disabled="isDisabled('showScrubber')"
                  />
                </q-item-section>
              </q-item>
            </q-list>
          </recess>
        </q-expansion-item>
      </q-list>

      <q-separator />

      <q-card-actions align="right">
        <q-btn :label="$t('Close')" color="accent" flat v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { zipObject } from "lodash";
import { HOTKEYS_FORMATTED } from "../../keymap";

const props = [
  "animateBoard",
  "axisLabels",
  "board3D",
  "flatCounts",
  "highlightSquares",
  "notifyGame",
  "notifyNotes",
  "pieceShadows",
  "playSpeed",
  "showAllBranches",
  "showControls",
  "showMove",
  "showRoads",
  "showScrubber",
  "unplayedPieces"
];

export default {
  name: "UISettings",
  props: ["value", "disabled"],
  data() {
    return {
      hotkeys: HOTKEYS_FORMATTED.UI
    };
  },
  computed: zipObject(
    props,
    props.map(key => ({
      get() {
        return this.isDisabled(key) ? false : this.$store.state[key];
      },
      set(value) {
        this.$store.dispatch("SET_UI", [key, value]);
      }
    }))
  ),
  methods: {
    isDisabled(key) {
      return this.disabled && this.disabled.includes(key);
    }
  }
};
</script>

<style lang="stylus">
.ui-settings
  .q-list .q-list
    min-height 10rem
    max-height 50vh
    @media (min-width: $breakpoint-sm-min)
      max-height calc(100vh - 264px)
</style>
