<template>
  <large-dialog
    ref="dialog"
    :value="true"
    no-backdrop-dismiss
    :min-height="588"
    :width="wideLayout ? 1100 : undefined"
    v-bind="$attrs"
  >
    <template v-slot:header>
      <dialog-header icon="png">{{ $t("Image Export") }}</dialog-header>
    </template>

    <div :class="{ 'config-layout': wideLayout }">
      <div
        ref="previewContainer"
        :class="{
          'config-preview': wideLayout,
          'config-preview-sticky': stickyPreview,
        }"
      >
        <smooth-reflow>
          <div
            v-if="config.svgFormat"
            ref="svgPreview"
            class="block svg-preview"
            v-html="svgPreview"
          />
          <img
            v-else
            ref="preview"
            class="block"
            :src="preview"
            @load="loadPreview"
            width="100%"
          />
        </smooth-reflow>
      </div>

      <q-list :class="{ 'config-options': wideLayout }">
        <ThemeSelector
          v-model="config.themeID"
          :config="$store.state.ui.pngConfig"
          item-aligned
          edit-button
          filled
        />

        <setting-row :entry="entries.svgFormat" />

        <q-item v-if="!config.svgFormat">
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
              markers
              snap
              label
            />
          </q-item-section>
        </q-item>

        <q-item v-else>
          <q-item-section>
            <q-item-label>
              <span class="float-right" v-html="fileSize" />
              {{ $t("Size") }}
            </q-item-label>
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
              markers
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
              markers
              snap
              label
            />
          </q-item-section>
        </q-item>

        <setting-row :entry="entries.padding" />

        <settings-sections />
      </q-list>
    </div>

    <template v-slot:footer>
      <q-separator />
      <q-card-actions align="right">
        <q-btn :label="$t('Reset')" @click="reset" flat />
        <div class="col-grow" />
        <q-btn :label="$t('Close')" color="primary" flat v-close-popup />
        <q-btn
          :label="$t('Download')"
          @click="download"
          color="primary"
          v-close-popup
        />
        <!-- <q-btn
          :label="$t(canShare ? 'Share URL' : 'Copy URL')"
          @click="share"
          color="primary"
          v-close-popup
        /> -->
      </q-card-actions>
    </template>
  </large-dialog>
</template>

<script>
import SettingsSections from "../components/settings/SettingsSections";
import ThemeSelector from "../components/controls/ThemeSelector";
import { configScope, localEntry } from "../settings/scope";
import {
  IMAGE_IDS,
  IMAGE_OVERRIDES,
  playerNames,
} from "../settings/exportScopes";
import { imgUIOptions } from "../store/ui/state";
import { imageOptions } from "../utils/imageExport";
import { TPStoPNG } from "tps-ninja/src/TPStoPNG.js";
import { TPStoSVGString } from "tps-ninja/src/TPStoSVG.js";

import { cloneDeep, debounce } from "lodash";

import { format } from "quasar";
const { humanStorageSize } = format;

// The image's own options, as setting rows
const entries = {
  svgFormat: localEntry("export:svgFormat", { label: "SVG Format" }),
  padding: localEntry("export:padding", { label: "Padding" }),
};

export default {
  name: "PNGConfig",
  components: { SettingsSections, ThemeSelector },
  // The rows edit this dialog's config, not the live settings
  provide() {
    return {
      settingsScope: configScope({
        state: () => ({ ui: this.config, export: this.config }),
        ids: IMAGE_IDS,
        overrides: IMAGE_OVERRIDES,
        local: [playerNames, ...Object.values(entries)],
      }),
    };
  },
  data() {
    const sizes = ["xs", "sm", "md", "lg", "xl"];
    return {
      config: cloneDeep(this.$store.state.ui.pngConfig),
      preview: "",
      svgPreview: "",
      previewContainerHeight: 0,
      dimensions: "",
      file: null,
      fileSize: "",
      imageSize: sizes.indexOf(this.$store.state.ui.pngConfig.imageSize),
      textSize: sizes.indexOf(this.$store.state.ui.pngConfig.textSize),
      sizes,
    };
  },
  computed: {
    entries() {
      return entries;
    },
    game() {
      return this.$store.state.game;
    },
    canShare() {
      return this.$store.state.nativeSharing;
    },
    wideLayout() {
      return this.$q.screen.width >= 800;
    },
    stickyPreview() {
      if (this.wideLayout) return true;
      return (
        this.previewContainerHeight > 0 &&
        this.$q.screen.height >= 2 * this.previewContainerHeight
      );
    },
  },
  methods: {
    getExportConfig() {
      return imageOptions(this.$store, this.config);
    },
    updatePreview: debounce(function () {
      const config = this.getExportConfig();
      const filename = this.$store.getters["ui/imageFilename"]({
        name: this.game.name,
        plyID: this.game.position.plyID,
        plyIsDone: this.game.position.plyIsDone,
        svg: this.config.svgFormat,
      });

      if (this.config.svgFormat) {
        // The size setting is for the raster image; a vector's dimensions
        // (and the border and piece proportions derived from them) should
        // not change with it.
        const svgString = TPStoSVGString({
          ...config,
          imageSize: "md",
          imageWidth: null,
          imageHeight: null,
        });
        this.svgPreview = svgString;
        const blob = new Blob([svgString], { type: "image/svg+xml" });
        this.file = new File([blob], filename, { type: "image/svg+xml" });
        this.fileSize = humanStorageSize(this.file.size);
        this.dimensions = "";
        this.$nextTick(() => this.measurePreview());
      } else {
        TPStoPNG(config).toBlob((blob) => {
          this.file = new File([blob], filename, { type: "image/png" });
          this.fileSize = humanStorageSize(this.file.size);
          this.preview = URL.createObjectURL(blob);
        });
      }
    }),
    loadPreview() {
      const img = this.$refs.preview;
      this.dimensions =
        img.naturalWidth + " &times; " + img.naturalHeight + " px";
      this.$nextTick(() => {
        this.measurePreview();
      });
    },
    measurePreview() {
      if (this.$refs.previewContainer) {
        this.previewContainerHeight = this.$refs.previewContainer.offsetHeight;
      }
    },
    reset() {
      this.prompt({
        title: this.$t("Confirm"),
        message: this.$t("confirm.resetPNG"),
        success: () => {
          const config = cloneDeep(this.$store.state.ui.defaults.pngConfig);
          Object.keys(config).forEach((key) => {
            if (imgUIOptions.includes(key)) {
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
      this.$store.dispatch("ui/SHARE", {
        title: "PNG",
        text: this.$store.getters["ui/png_url"](),
      });
    },
    close() {
      this.$refs.dialog.hide();
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

<style scoped>
.svg-preview >>> svg {
  width: 100%;
  height: auto;
  display: block;
}
</style>
