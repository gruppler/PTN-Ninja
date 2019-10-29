<template>
  <q-dialog :value="value" @input="$emit('input', $event)" no-route-dismiss>
    <q-card style="width: 300px" class="bg-secondary" dark>
      <q-card-section>
        <q-btn
          class="float-right"
          icon="close"
          color="white"
          flat
          round
          v-close-popup
        />
        <div class="text-h6 text-white">{{ $t("Preferences") }}</div>
      </q-card-section>

      <q-separator dark />

      <q-list separator dark>
        <q-expansion-item
          icon="apps"
          :label="$t('Board')"
          group="settings"
          default-opened
        >
          <q-list style="max-height: 50vh">
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
                <q-item-label>{{ $t("Board 3D") }}</q-item-label>
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

            <q-item tag="label" :title="hotkeys.highlightSquares" v-ripple>
              <q-item-section>
                <q-item-label>{{
                  $t("Highlight Current Squares")
                }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle color="accent" v-model="highlightSquares" />
              </q-item-section>
            </q-item>

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
                  dark
                  label
                />
              </q-item-section>
            </q-item>
            <div class="absolute-fit inset-shadow no-pointer-events" />
          </q-list>
        </q-expansion-item>

        <q-expansion-item icon="settings" :label="$t('UI')" group="settings">
          <q-list style="max-height: 50vh">
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
            <div class="absolute-fit inset-shadow no-pointer-events" />
          </q-list>
        </q-expansion-item>
      </q-list>

      <q-separator dark />

      <q-card-actions align="right">
        <q-btn :label="$t('Done')" flat v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { zipObject } from "lodash";
import { HOTKEYS_FORMATTED } from "../keymap";

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
  props: ["value"],
  data() {
    return {
      hotkeys: HOTKEYS_FORMATTED.UI
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

<style></style>
