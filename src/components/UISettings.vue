<template>
  <q-dialog :value="value" @input="$emit('input', $event)">
    <q-card style="width: 300px" class="bg-secondary text-accent" dark>
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

      <q-card-section style="max-height: 60vh" class="scroll">
        <q-list dark>
          <q-expansion-item
            :label="$t('Board')"
            group="settings"
            switch-toggle-side
            default-opened
          >
            <q-list>
              <q-item tag="label" :title="hotkeys.axisLabels" v-ripple>
                <q-item-section>
                  <q-item-label>{{ $t("Axis_Labels") }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle color="accent" v-model="axisLabels" />
                </q-item-section>
              </q-item>

              <q-item tag="label" :title="hotkeys.showRoads" v-ripple>
                <q-item-section>
                  <q-item-label>{{ $t("Road_Connections") }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle color="accent" v-model="showRoads" />
                </q-item-section>
              </q-item>

              <q-item tag="label" :title="hotkeys.pieceShadows" v-ripple>
                <q-item-section>
                  <q-item-label>{{ $t("Piece_Shadows") }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle color="accent" v-model="pieceShadows" />
                </q-item-section>
              </q-item>

              <q-item tag="label" :title="hotkeys.flatCounts" v-ripple>
                <q-item-section>
                  <q-item-label>{{ $t("Flat_Counts") }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle color="accent" v-model="flatCounts" />
                </q-item-section>
              </q-item>

              <q-item tag="label" :title="hotkeys.unplayedPieces" v-ripple>
                <q-item-section>
                  <q-item-label>{{ $t("Unplayed_Pieces") }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle color="accent" v-model="unplayedPieces" />
                </q-item-section>
              </q-item>

              <q-item tag="label" :title="hotkeys.showMove" v-ripple>
                <q-item-section>
                  <q-item-label>{{ $t("Current_Move") }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle color="accent" v-model="showMove" />
                </q-item-section>
              </q-item>

              <q-item tag="label" :title="hotkeys.highlightSquares" v-ripple>
                <q-item-section>
                  <q-item-label>{{ $t("Highlight_Square") }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle color="accent" v-model="highlightSquares" />
                </q-item-section>
              </q-item>

              <q-item>
                <q-item-section>
                  {{ $t("Play_Speed") }}
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
            </q-list>
          </q-expansion-item>

          <q-expansion-item
            :label="$t('UI')"
            group="settings"
            switch-toggle-side
          >
            <q-list>
              <q-item tag="label" :title="hotkeys.showAllBranches" v-ripple>
                <q-item-section>
                  <q-item-label>{{ $t("Show_All_Branches") }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle color="accent" v-model="showAllBranches" />
                </q-item-section>
              </q-item>

              <q-item tag="label" :title="hotkeys.notifyNotes" v-ripple>
                <q-item-section>
                  <q-item-label>{{
                    $t("Show_Note_Notifications")
                  }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle color="accent" v-model="notifyNotes" />
                </q-item-section>
              </q-item>

              <q-item tag="label" :title="hotkeys.showControls" v-ripple>
                <q-item-section>
                  <q-item-label>{{ $t("Play_Controls") }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle color="accent" v-model="showControls" />
                </q-item-section>
              </q-item>

              <q-item tag="label" :title="hotkeys.showScrubber" v-ripple>
                <q-item-section>
                  <q-item-label>{{ $t("Scrub_Bar") }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle color="accent" v-model="showScrubber" />
                </q-item-section>
              </q-item>
            </q-list>
          </q-expansion-item>
        </q-list>
      </q-card-section>

      <q-separator dark />

      <q-card-actions align="right">
        <q-btn :label="$t('Done')" flat v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { zipObject } from "lodash";
import { HOTKEYS_FORMATTED } from "../constants";

const props = [
  "axisLabels",
  "flatCounts",
  "highlightSquares",
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
