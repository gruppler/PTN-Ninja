<template>
  <q-dialog :value="value" @input="$emit('input', $event)" no-backdrop-dismiss>
    <q-card style="width: 500px;" class="bg-secondary">
      <div class="column">
        <div class="relative-position">
          <iframe
            ref="preview"
            class="block"
            @load="previewLoaded = true"
            @error="previewError = true"
            :src="initialURL"
            width="100%"
            :height="previewHeight"
            frameborder="0"
            allowfullscreen
          />
          <QInnerLoading :showing="!previewLoaded && !previewError" />
        </div>
        <SmoothReflow>
          <Recess>
            <q-card-section
              :style="{
                maxHeight: `calc(100vh - 14rem - ${previewHeight})`,
                minHeight: '7rem'
              }"
              class="scroll q-pa-none"
            >
              <q-list style="max-height: 50vh">
                <q-item>
                  <q-item-section>
                    <q-input
                      v-model="name"
                      name="name"
                      :label="$t('Title')"
                      color="accent"
                      filled
                    >
                      <template v-slot:append>
                        <q-btn
                          @click="
                            name =
                              name === game.name ? generatedName : game.name
                          "
                          icon="refresh"
                          dense
                          flat
                        />
                      </template>
                    </q-input>
                  </q-item-section>
                </q-item>

                <q-item>
                  <q-item-section>
                    <q-input
                      v-model="config.width"
                      :label="$t('Width')"
                      hide-bottom-space
                      color="accent"
                      filled
                    />
                  </q-item-section>
                  <q-item-section>
                    <q-input
                      v-model="config.height"
                      :label="$t('Height')"
                      hide-bottom-space
                      color="accent"
                      filled
                    />
                  </q-item-section>
                </q-item>

                <q-item tag="label" v-ripple>
                  <q-item-section>
                    <q-item-label>{{ $t("From current ply") }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-toggle color="accent" v-model="config.state" />
                  </q-item-section>
                </q-item>

                <q-item v-show="showAll">
                  <q-item-section>
                    {{ $t("Play Speed") }}
                    <q-slider
                      v-model="config.ui.playSpeed"
                      :min="30"
                      :max="160"
                      :label-value="config.ui.playSpeed + ' ' + $t('BPM')"
                      :step="10"
                      color="accent"
                      snap
                      label
                    />
                  </q-item-section>
                </q-item>

                <q-item v-show="showAll" tag="label" v-ripple>
                  <q-item-section>
                    <q-item-label>{{ $t("Show All Branches") }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-toggle
                      color="accent"
                      v-model="config.ui.showAllBranches"
                    />
                  </q-item-section>
                </q-item>

                <q-item v-show="showAll" tag="label" v-ripple>
                  <q-item-section>
                    <q-item-label>{{ $t("Axis Labels") }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-toggle color="accent" v-model="config.ui.axisLabels" />
                  </q-item-section>
                </q-item>

                <q-item v-show="showAll" tag="label" v-ripple>
                  <q-item-section>
                    <q-item-label>{{ $t("Road Connections") }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-toggle color="accent" v-model="config.ui.showRoads" />
                  </q-item-section>
                </q-item>

                <q-item v-show="showAll" tag="label" v-ripple>
                  <q-item-section>
                    <q-item-label>{{ $t("Highlight Squares") }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-toggle
                      color="accent"
                      v-model="config.ui.highlightSquares"
                    />
                  </q-item-section>
                </q-item>

                <q-item v-show="showAll" tag="label" v-ripple>
                  <q-item-section>
                    <q-item-label>{{ $t("Flat Counts") }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-toggle color="accent" v-model="config.ui.flatCounts" />
                  </q-item-section>
                </q-item>

                <q-item v-show="showAll" tag="label" v-ripple>
                  <q-item-section>
                    <q-item-label>{{ $t("Unplayed Pieces") }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-toggle
                      color="accent"
                      v-model="config.ui.unplayedPieces"
                    />
                  </q-item-section>
                </q-item>

                <q-item v-show="showAll" tag="label" v-ripple>
                  <q-item-section>
                    <q-item-label>{{ $t("Current Move") }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-toggle color="accent" v-model="config.ui.showMove" />
                  </q-item-section>
                </q-item>

                <q-item v-show="showAll" tag="label" v-ripple>
                  <q-item-section>
                    <q-item-label>{{ $t("Play Controls") }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-toggle color="accent" v-model="config.ui.showControls" />
                  </q-item-section>
                </q-item>

                <q-item v-show="showAll" tag="label" v-ripple>
                  <q-item-section>
                    <q-item-label>{{ $t("Scrub Bar") }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-toggle color="accent" v-model="config.ui.showScrubber" />
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card-section>
          </Recess>
        </SmoothReflow>
      </div>

      <q-separator />

      <q-card-actions class="row items-center justify-end q-gutter-sm">
        <MoreToggle v-model="showAll" />
        <q-btn :label="$t('Reset')" @click="reset" flat />
        <div class="col-grow" />
        <q-btn :label="$t('Copy')" @click="copy" color="accent" flat />
        <q-btn :label="$t('Close')" color="accent" flat v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import MoreToggle from "../general/MoreToggle.vue";

import { cloneDeep } from "lodash";

export default {
  name: "EmbedConfig",
  components: { MoreToggle },
  props: ["value", "game"],
  data() {
    return {
      name: this.game.name,
      config: cloneDeep(this.$store.state.embedConfig),
      showAll: false,
      previewError: false,
      previewLoaded: false,
      initialURL: ""
    };
  },
  computed: {
    previewHeight() {
      return this.previewError ? "0" : "333px";
    },
    generatedName() {
      return this.game.generateName();
    },
    url() {
      return this.$store.getters.url(this.game, {
        origin: true,
        name: this.name,
        state: this.config.state,
        ui: this.config.ui
      });
    },
    code() {
      return `<iframe src="${this.url}" width="${this.config.width}" height="${
        this.config.height
      }" style="width:${this.config.width}; max-width:100vw; height:${
        this.config.height
      }; max-height:100vh;" frameborder="0" allowfullscreen />`;
    }
  },
  methods: {
    reset() {
      this.config = cloneDeep(this.$store.state.defaults.embedConfig);
    },
    copy() {
      this.$store.dispatch("COPY", {
        text: this.code,
        message: this.$t("Copied")
      });
    },
    close() {
      this.$emit("input", false);
    }
  },
  watch: {
    value(isVisible) {
      if (isVisible) {
        this.name = this.game.name;
        this.initialURL = this.url;
      } else {
        this.previewError = false;
        this.previewLoaded = false;
      }
    },
    url(url) {
      if (this.$refs.preview) {
        this.$refs.preview.contentWindow.location.replace(url);
      }
    },
    config: {
      handler(value) {
        this.$store.dispatch("SET_UI", ["embedConfig", cloneDeep(value)]);
      },
      deep: true
    }
  }
};
</script>
