<template>
  <large-dialog
    :value="true"
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
      <ThemeSelector
        v-model="config.themeID"
        :config="$store.state.ui.pngConfig"
        item-aligned
        edit-button
        filled
      />

      <q-item>
        <q-item-section>
          <q-item-label>
            <span class="float-right" v-html="dimensions" />
            <span class="float-right q-mr-md" v-html="fileSize" />
            {{ $t("Size") }}
          </q-item-label>
          <q-slider
            v-model="imageSize"
            :min="0"
            :max="4"
            :label-value="sizes[imageSize]"
            :step="1"
            snap
            label
          />
        </q-item-section>
      </q-item>

      <q-item>
        <q-item-section>
          <q-item-label>
            {{ $t("Text Size") }}
          </q-item-label>
          <q-slider
            v-model="textSize"
            :min="0"
            :max="4"
            :label-value="sizes[textSize]"
            :step="1"
            snap
            label
          />
        </q-item-section>
      </q-item>

      <q-item>
        <q-item-section>
          <q-item-label>
            {{ $t("Background Opacity") }}
          </q-item-label>
          <q-slider
            v-model="config.bgAlpha"
            :min="0"
            :max="1"
            :label-value="Math.round(config.bgAlpha * 100) + '%'"
            :step="0.05"
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
          <q-toggle v-model="config.axisLabels" />
        </q-item-section>
      </q-item>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Road Connections") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle v-model="config.showRoads" />
        </q-item-section>
      </q-item>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Turn Indicator") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle v-model="config.turnIndicator" />
        </q-item-section>
      </q-item>

      <smooth-reflow>
        <div v-show="config.turnIndicator">
          <q-item tag="label" v-ripple>
            <q-item-section>
              <q-item-label>{{ $t("Player Names") }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-toggle v-model="config.includeNames" />
            </q-item-section>
          </q-item>

          <q-item tag="label" v-ripple>
            <q-item-section>
              <q-item-label>{{ $t("Flat Counts") }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-toggle v-model="config.flatCounts" />
            </q-item-section>
          </q-item>
        </div>
      </smooth-reflow>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Highlight Squares") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle v-model="config.highlightSquares" />
        </q-item-section>
      </q-item>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Piece Shadows") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle v-model="config.pieceShadows" />
        </q-item-section>
      </q-item>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Unplayed Pieces") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle v-model="config.unplayedPieces" />
        </q-item-section>
      </q-item>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Padding") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle v-model="config.padding" />
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
        <q-btn :label="$t('Close')" color="primary" flat v-close-popup />
      </q-card-actions>
    </template>
  </large-dialog>
</template>

<script>
import ThemeSelector from "../components/controls/ThemeSelector";
import { pngUIOptions } from "../store/ui/state";

import { cloneDeep } from "lodash";

import { format } from "quasar";
const { humanStorageSize } = format;

export default {
  name: "PNGConfig",
  components: { ThemeSelector },
  data() {
    const sizes = ["xs", "sm", "md", "lg", "xl"];
    return {
      config: cloneDeep(this.$store.state.ui.pngConfig),
      preview: "",
      dimensions: "",
      file: null,
      fileSize: 0,
      imageSize: sizes.indexOf(this.$store.state.ui.pngConfig.imageSize),
      textSize: sizes.indexOf(this.$store.state.ui.pngConfig.textSize),
      sizes,
    };
  },
  computed: {
    url() {
      return this.$store.getters["ui/png_url"](this.$game);
    },
    theme: {
      get() {
        return isString(this.config.theme)
          ? this.config.theme
          : this.config.theme.id;
      },
      set(id) {
        const theme = this.$store.getters["ui/theme"](id);
        if (theme) {
          if (!theme.isBuiltIn) {
            this.config.theme = theme;
          } else {
            this.config.theme = id;
          }
        }
      },
    },
    tps() {
      return this.$game.board.tps;
    },
    canShare() {
      return this.$store.state.nativeSharing;
    },
  },
  methods: {
    updateConfig() {
      this.config = cloneDeep(this.$store.state.ui.pngConfig);
    },
    updatePreview() {
      const config = cloneDeep(this.config);
      this.config.theme = this.$store.getters["ui/theme"](this.config.themeID);
      let canvas = this.$game.board.render(config);
      const filename = this.$game.pngFilename;
      canvas.toBlob((blob) => {
        this.file = new File([blob], filename, {
          type: "image/png",
        });
        this.fileSize = humanStorageSize(this.file.size);
        this.preview = URL.createObjectURL(blob);
      });
    },
    loadPreview() {
      const img = this.$refs.preview;
      this.dimensions =
        img.naturalWidth + " &times; " + img.naturalHeight + " px";
    },
    reset() {
      this.$store.dispatch("ui/PROMPT", {
        title: this.$t("Confirm"),
        message: this.$t("confirm.resetPNG"),
        success: () => {
          const config = cloneDeep(this.$store.state.ui.defaults.pngConfig);
          Object.keys(config).forEach((key) => {
            if (pngUIOptions.includes(key)) {
              config[key] = this.$store.state.ui[key];
            }
          });
          config.themeID = this.$store.state.ui.themeID;
          config.theme = this.$store.state.ui.theme;
          this.config = config;
          this.imageSize = this.sizes.indexOf(config.imageSize);
          this.textSize = this.sizes.indexOf(config.textSize);
        },
      });
    },
    download() {
      this.$store.dispatch("ui/DOWNLOAD_FILES", this.file);
    },
    share() {
      this.$store.dispatch("ui/COPY", {
        title: this.$t("Share PNG"),
        url: this.url,
      });
    },
    close() {
      this.$router.back();
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
        this.$store.dispatch("ui/SET_UI", ["pngConfig", cloneDeep(config)]);
        this.updatePreview();
      },
      deep: true,
    },
    imageSize(i) {
      this.config.imageSize = this.sizes[i];
    },
    textSize(i) {
      this.config.textSize = this.sizes[i];
    },
  },
  mounted() {
    this.updatePreview();
  },
};
</script>
