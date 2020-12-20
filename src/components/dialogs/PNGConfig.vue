<template>
  <large-dialog
    :value="value"
    @input="$emit('input', $event)"
    no-backdrop-dismiss
    :min-height="588"
    v-bind="$attrs"
  >
    <template v-slot:header>
      <dialog-header icon="file_image">{{ $t("PNG Image") }}</dialog-header>
    </template>

    <smooth-reflow>
      <img
        ref="preview"
        class="block"
        :src="preview"
        @load="loadPreview"
        width="100%"
        frameborder="0"
        allowfullscreen
      />
    </smooth-reflow>

    <q-list>
      <q-item>
        <q-item-section>
          <q-item-label>
            <span class="float-right" v-html="dimensions" />
            <span class="float-right q-mr-md" v-html="fileSize" />
            {{ $t("Size") }}
          </q-item-label>
          <q-slider
            v-model="size"
            :min="0"
            :max="4"
            :label-value="sizes[size]"
            :step="1"
            color="accent"
            snap
            label
          />
        </q-item-section>
      </q-item>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Axis Labels") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle color="accent" v-model="config.axisLabels" />
        </q-item-section>
      </q-item>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Road Connections") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle color="accent" v-model="config.showRoads" />
        </q-item-section>
      </q-item>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Turn Indicator") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle color="accent" v-model="config.turnIndicator" />
        </q-item-section>
      </q-item>

      <smooth-reflow>
        <div v-show="config.turnIndicator">
          <q-item tag="label" v-ripple>
            <q-item-section>
              <q-item-label>{{ $t("Player Names") }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-toggle color="accent" v-model="config.includeNames" />
            </q-item-section>
          </q-item>

          <q-item tag="label" v-ripple>
            <q-item-section>
              <q-item-label>{{ $t("Flat Counts") }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-toggle color="accent" v-model="config.flatCounts" />
            </q-item-section>
          </q-item>
        </div>
      </smooth-reflow>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Highlight Squares") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle color="accent" v-model="config.highlightSquares" />
        </q-item-section>
      </q-item>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Piece Shadows") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle color="accent" v-model="config.pieceShadows" />
        </q-item-section>
      </q-item>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Unplayed Pieces") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle color="accent" v-model="config.unplayedPieces" />
        </q-item-section>
      </q-item>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Padding") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle color="accent" v-model="config.padding" />
        </q-item-section>
      </q-item>
    </q-list>

    <template v-slot:footer>
      <q-separator />
      <q-card-actions align="right">
        <q-btn :label="$t('Reset')" @click="reset" flat />
        <div class="col-grow" />
        <q-btn :label="$t('Download')" @click="download" flat />
        <q-btn
          :label="$t(canShare ? 'Share URL' : 'Copy URL')"
          @click="share"
          flat
        />
        <q-btn :label="$t('Close')" color="accent" flat v-close-popup />
      </q-card-actions>
    </template>
  </large-dialog>
</template>

<script>
import { pngUIOptions } from "../../store/ui/state";

import { cloneDeep } from "lodash";

import { format } from "quasar";
const { humanStorageSize } = format;

export default {
  name: "PNGConfig",
  props: ["value", "game"],
  data() {
    const sizes = ["xs", "sm", "md", "lg", "xl"];
    return {
      config: cloneDeep(this.$store.state.pngConfig),
      preview: "",
      dimensions: "",
      file: null,
      fileSize: 0,
      size: sizes.indexOf(this.$store.state.pngConfig.size),
      sizes,
    };
  },
  computed: {
    url() {
      return this.$store.getters.png_url(this.game);
    },
    tps() {
      return this.game.state.tps;
    },
    canShare() {
      return navigator.canShare;
    },
  },
  methods: {
    updateConfig() {
      this.config = cloneDeep(this.$store.state.pngConfig);
    },
    updatePreview() {
      const filename = this.$store.getters.png_filename(this.game);
      const canvas = this.game.render(this.config);
      this.preview = canvas.toDataURL();
      canvas.toBlob((blob) => {
        this.file = new File([blob], filename, {
          type: "image/png",
        });
        this.fileSize = humanStorageSize(this.file.size);
      });
    },
    loadPreview() {
      const img = this.$refs.preview;
      this.dimensions =
        img.naturalWidth + " &times; " + img.naturalHeight + " px";
    },
    reset() {
      this.$store.dispatch("PROMPT", {
        title: this.$t("Confirm"),
        message: this.$t("confirm.resetPNG"),
        success: () => {
          const config = cloneDeep(this.$store.state.defaults.pngConfig);
          Object.keys(config).forEach((key) => {
            if (pngUIOptions.includes(key)) {
              config[key] = this.$store.state[key];
            }
          });
          this.config = config;
          this.size = this.sizes.indexOf(config.size);
        },
      });
    },
    download() {
      this.$store.dispatch("DOWNLOAD_FILES", this.file);
    },
    share() {
      this.$store.dispatch("COPY", {
        title: this.$t("Share PNG"),
        url: this.url,
      });
    },
    close() {
      this.$emit("input", false);
    },
  },
  watch: {
    tps() {
      if (this.value) {
        this.updatePreview();
      }
    },
    config: {
      handler(config) {
        this.$store.dispatch("SET_UI", ["pngConfig", cloneDeep(config)]);
        this.updatePreview();
      },
      deep: true,
    },
    size(i) {
      this.config.size = this.sizes[i];
    },
    value(show) {
      if (show) {
        this.updatePreview();
      }
    },
  },
  created() {
    this.updatePreview();
  },
};
</script>
