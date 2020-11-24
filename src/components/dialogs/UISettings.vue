<template>
  <q-dialog
    :value="value"
    @input="$emit('input', $event)"
    content-class="ui-settings non-selectable"
    v-bind="$attrs"
  >
    <q-card style="width: 300px" class="bg-secondary">
      <dialog-header icon="settings">{{ $t("Preferences") }}</dialog-header>

      <q-separator />

      <q-list separator>
        <q-expansion-item
          icon="board"
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
                  <q-toggle color="accent" v-model="animateBoard" />
                </q-item-section>
              </q-item>

              <q-item tag="label" :title="hotkeys.axisLabels" v-ripple>
                <q-item-section>
                  <q-item-label>{{ $t("Axis Labels") }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle color="accent" v-model="axisLabels" />
                </q-item-section>
              </q-item>

              <q-item tag="label" :title="hotkeys.board3D" v-ripple>
                <q-item-section>
                  <q-item-label>{{ $t("3D Board") }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle color="accent" v-model="board3D" />
                </q-item-section>
              </q-item>

              <q-item tag="label" :title="hotkeys.showRoads" v-ripple>
                <q-item-section>
                  <q-item-label>{{ $t("Road Connections") }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle color="accent" v-model="showRoads" />
                </q-item-section>
              </q-item>

              <q-item tag="label" :title="hotkeys.highlightSquares" v-ripple>
                <q-item-section>
                  <q-item-label>{{ $t("Highlight Squares") }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle color="accent" v-model="highlightSquares" />
                </q-item-section>
              </q-item>

              <q-item tag="label" :title="hotkeys.pieceShadows" v-ripple>
                <q-item-section>
                  <q-item-label>{{ $t("Piece Shadows") }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle color="accent" v-model="pieceShadows" />
                </q-item-section>
              </q-item>

              <q-item tag="label" :title="hotkeys.flatCounts" v-ripple>
                <q-item-section>
                  <q-item-label>{{ $t("Flat Counts") }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle color="accent" v-model="flatCounts" />
                </q-item-section>
              </q-item>

              <q-item tag="label" :title="hotkeys.unplayedPieces" v-ripple>
                <q-item-section>
                  <q-item-label>{{ $t("Unplayed Pieces") }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle color="accent" v-model="unplayedPieces" />
                </q-item-section>
              </q-item>

              <q-item tag="label" :title="hotkeys.showMove" v-ripple>
                <q-item-section>
                  <q-item-label>{{ $t("Current Move") }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle color="accent" v-model="showMove" />
                </q-item-section>
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
                color="accent"
                popup-content-class="bg-secondary"
                item-aligned
                map-options
                emit-value
                filled
              />

              <q-item tag="label" :title="hotkeys.showAllBranches" v-ripple>
                <q-item-section>
                  <q-item-label>{{ $t("Show All Branches") }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle color="accent" v-model="showAllBranches" />
                </q-item-section>
              </q-item>

              <q-item tag="label" :title="hotkeys.notifyGame" v-ripple>
                <q-item-section>
                  <q-item-label>{{ $t("Game Notifications") }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle color="accent" v-model="notifyGame" />
                </q-item-section>
              </q-item>

              <q-item tag="label" :title="hotkeys.notifyNotes" v-ripple>
                <q-item-section>
                  <q-item-label>{{ $t("Note Notifications") }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle color="accent" v-model="notifyNotes" />
                </q-item-section>
              </q-item>

              <q-item tag="label" :title="hotkeys.showControls" v-ripple>
                <q-item-section>
                  <q-item-label>{{ $t("Play Controls") }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle color="accent" v-model="showControls" />
                </q-item-section>
              </q-item>

              <q-item tag="label" :title="hotkeys.showScrubber" v-ripple>
                <q-item-section>
                  <q-item-label>{{ $t("Scrub Bar") }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle color="accent" v-model="showScrubber" />
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
  "openDuplicate",
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
  props: ["value"],
  data() {
    return {
      hotkeys: HOTKEYS_FORMATTED.UI,
      openDuplicateOptions: [
        { label: this.$t("Rename"), value: "rename" },
        { label: this.$t("Replace"), value: "replace" }
      ]
    };
  },
  computed: zipObject(
    props,
    props.map(key => ({
      get() {
        return this.$store.state[key];
      },
      set(value) {
        this.$store.dispatch("SET_UI", [key, value]);
      }
    }))
  )
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
