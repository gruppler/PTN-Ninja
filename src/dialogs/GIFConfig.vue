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
      <dialog-header icon="gif">{{ $t("Configure GIF") }}</dialog-header>
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
          <img
            v-if="preview"
            ref="preview"
            class="block"
            :src="preview"
            @load="loadPreview"
            width="100%"
          />
        </smooth-reflow>
        <div class="relative-position">
          <q-btn
            class="full-width no-border-radius"
            @click="updatePreview"
            :loading="updating"
            :percentage="progress"
            icon="refresh"
            :label="$t('Generate')"
            color="primary"
          />
          <q-btn
            v-if="updating"
            class="gif-generate-cancel no-border-radius"
            @click="cancelGeneration"
            :label="$t('Cancel')"
            color="primary"
            :text-color="
              $store.state.ui.theme.primaryDark ? 'textLight' : 'textDark'
            "
            flat
          />
        </div>
      </div>

      <q-list :class="{ 'config-options': wideLayout }">
        <div class="row no-wrap justify-around">
          <img class="block" :src="previewStart" style="max-width: 50%" />
          <img class="block" :src="previewEnd" style="max-width: 50%" />
        </div>
        <q-item>
          <q-item-section>
            {{ $t("Plies") }}
            <q-range
              v-model="config.plyRange"
              :min="0"
              :max="branchPlies.length - 1"
              :left-label-value="getPlyLabel(config.plyRange.min)"
              :right-label-value="getPlyLabel(config.plyRange.max)"
              :step="1"
              markers
              snap
              label
            />
          </q-item-section>
        </q-item>

        <q-item>
          <q-item-section>
            {{ $t("Play Speed") }}
            <q-slider
              v-model="config.playSpeed"
              :min="20"
              :max="160"
              :label-value="config.playSpeed + ' ' + $t('FPM')"
              :step="10"
              markers
              snap
              label
            />
          </q-item-section>
        </q-item>

        <ThemeSelector
          v-model="config.themeID"
          :config="$store.state.ui.gifConfig"
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
              markers
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
              markers
              snap
              label
            />
          </q-item-section>
        </q-item>

        <setting-row :entry="entries.transparent" />
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
          :loading="downloading"
          :disable="updating"
          color="primary"
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
import {
  getActiveEvalDisplaySource,
  getEvalNumberOrder,
  getSelectedSuggestionForTps,
} from "../utils/evalDisplaySource";
import { PTNtoTPS } from "tps-ninja/src/PTNtoTPS.js";
import { TPStoPNG } from "tps-ninja/src/TPStoPNG.js";
import { generateGIFInWorker, terminateGIFWorker } from "../workers/gif";

import { cloneDeep, debounce } from "lodash";

import { format } from "quasar";
const { humanStorageSize } = format;

// The GIF's own options, as setting rows
const entries = {
  transparent: localEntry("export:transparent", {
    label: "Transparent Background",
  }),
  padding: localEntry("export:padding", { label: "Padding" }),
};
const delayAnalysis = localEntry("export:delayAnalysis", {
  label: "Delay Analysis",
  dependsOn: "ui:showAnalysisBoard",
});

export default {
  name: "GIFConfig",
  components: { SettingsSections, ThemeSelector },
  // The rows edit this dialog's config, not the live settings
  provide() {
    return {
      settingsScope: configScope({
        state: () => ({ ui: this.config, export: this.config }),
        ids: IMAGE_IDS,
        overrides: IMAGE_OVERRIDES,
        local: [playerNames, delayAnalysis, ...Object.values(entries)],
      }),
    };
  },
  data() {
    const sizes = ["xs", "sm", "md", "lg", "xl"];
    return {
      updating: false,
      downloading: false,
      progress: 0,
      config: cloneDeep(this.$store.state.ui.gifConfig),
      preview: "",
      previewStart: "",
      previewEnd: "",
      previewContainerHeight: 0,
      dimensions: "",
      file: null,
      fileSize: "",
      cancelRequested: false,
      imageSize: sizes.indexOf(this.$store.state.ui.gifConfig.imageSize),
      textSize: sizes.indexOf(this.$store.state.ui.gifConfig.textSize),
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
    branchPlies() {
      return this.game.ptn.branchPlies;
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
    options() {
      const options = cloneDeep(this.config);
      const selectedPlies = this.branchPlies.slice(
        options.plyRange.min,
        options.plyRange.max + 1
      );

      options.font = "Roboto";
      options.delay = Math.round(6e4 / options.playSpeed);
      const getSuffix = this.$store.getters["analysis/plyEvalSuffix"];
      options.plies = selectedPlies.map(
        (ply) =>
          ply.text + (options.evalText && getSuffix ? getSuffix(ply) : "")
      );
      options.hlSquares = options.highlightSquares;
      options.hlPieces = options.highlightPieces;
      options.hideFlatWinHighlights = !options.flatWinHighlights;
      options.transform = this.$store.state.ui.boardTransform;

      if (
        this.$store.state.game.highlighterEnabled &&
        Object.keys(this.$store.state.game.highlighterSquares).length
      ) {
        options.highlighter = this.$store.state.game.highlighterSquares;
      }

      if (options.plyRange.min > 0) {
        options.tps =
          (selectedPlies[0] && selectedPlies[0].tpsBefore) ||
          PTNtoTPS({
            size: this.game.config.size,
            tps: this.game.ptn.tags.tps ? this.game.ptn.tags.tps.text : null,
            plies: this.branchPlies
              .slice(0, options.plyRange.min)
              .map((ply) => ply.text),
          });
      } else if (this.game.ptn.tags.tps) {
        options.tps = this.game.ptn.tags.tps.text;
      } else {
        options.size = this.game.config.size;
      }

      const frameTps = [
        options.tps,
        ...selectedPlies.map((ply) => ply.tpsAfter || null),
      ];

      if (options.showAnalysisBoard) {
        const getSuggestionsForTps =
          this.$store.getters["analysis/pngSuggestionsForTps"];
        if (getSuggestionsForTps) {
          options.suggestionsByFrame = frameTps.map((tps) =>
            getSuggestionsForTps(tps)
          );
          options.suggestions = options.suggestionsByFrame[0] || null;
        }
      }

      const getEvaluationForTps = this.$store.getters["game/evaluationForTps"];
      const getWdlForTps = this.$store.getters["game/wdlForTps"];
      const getSuggestionsForTps =
        this.$store.getters["analysis/pngSuggestionsForTps"];
      if (options.boardEvalBar && getEvaluationForTps) {
        const analysis = this.$store.state.analysis;
        const initialTps = frameTps[0];
        const initialSuggestion = getSelectedSuggestionForTps({
          analysis,
          tps: initialTps,
          currentTps: this.$store.state.game.position.tps,
          getSuggestionsForTps: this.$store.getters["game/suggestions"],
        });

        options.evaluationsByFrame = frameTps.map((tps) => {
          const evaluation = getEvaluationForTps(tps);
          if (evaluation !== null) {
            return evaluation;
          }
          if (getSuggestionsForTps) {
            const suggestions = getSuggestionsForTps(tps) || [];
            return suggestions[0]?.evaluation ?? null;
          }
          return null;
        });
        options.evaluation = options.evaluationsByFrame[0] || null;

        const activeDisplaySource = getActiveEvalDisplaySource({
          analysisSource: analysis && analysis.analysisSource,
          suggestion: initialSuggestion,
          evaluation: options.evaluation,
          evalNumberOrder: getEvalNumberOrder(analysis && analysis.evalType),
        });
        options.evalBarMode = activeDisplaySource === "wdl" ? "wdl" : "single";

        options.wdlsByFrame = frameTps.map((tps) => {
          const wdl = getWdlForTps ? getWdlForTps(tps) : null;
          if (wdl !== null && wdl !== undefined) {
            return wdl;
          }
          if (getSuggestionsForTps) {
            const suggestions = getSuggestionsForTps(tps) || [];
            const suggestion = suggestions[0] || null;
            if (!suggestion) {
              return null;
            }
            if (suggestion.wdl) {
              return suggestion.wdl;
            }
            if (
              suggestion.wins1 != null ||
              suggestion.draws != null ||
              suggestion.wins2 != null
            ) {
              return {
                wins1: suggestion.wins1 ?? null,
                draws: suggestion.draws ?? null,
                wins2: suggestion.wins2 ?? null,
              };
            }
          }
          return null;
        });
        options.wdl = options.wdlsByFrame[0] || null;
      }

      if (options.transparent) {
        options.bgAlpha = 0;
      }

      options.theme = this.$store.getters["ui/theme"](this.config.themeID);

      // Game Tags
      const tags = [
        "caps",
        "flats",
        "caps1",
        "flats1",
        "caps2",
        "flats2",
        "komi",
        "opening",
      ];
      if (options.includeNames) {
        tags.push("player1", "player2");
      }
      tags.forEach((tagName) => {
        if (tagName in this.game.ptn.tags) {
          options[tagName] = this.game.ptn.tags[tagName];
        }
      });

      options.name = this.filename;

      // Remove invalid options
      delete options.themeID;
      delete options.plyRange;
      delete options.playSpeed;
      delete options.includeNames;
      delete options.highlightSquares;
      delete options.highlightPieces;
      delete options.flatWinHighlights;

      return options;
    },
    filename() {
      return this.$store.getters["ui/gif_filename"]({
        name: this.game.name,
        ...this.config.plyRange,
      });
    },
    url() {
      return this.$store.getters["ui/gif_url"](this.options);
    },
  },
  methods: {
    updateConfig() {
      this.config = cloneDeep(this.$store.state.ui.gifConfig);
      this.config.plyRange.max = Math.min(
        this.config.plyRange.max,
        this.branchPlies.length - 1
      );
    },
    getPlyLabel(index) {
      let ply = this.branchPlies[index];
      return ply
        ? `${ply.linenum.number}.${ply.player === 2 ? " --" : ""} ${ply.text}`
        : "";
    },
    isGenerationCanceled(error) {
      if (!error) return false;
      const message = (error && error.message) || String(error);
      return /terminated|abort|cancel/i.test(message);
    },
    cancelGeneration() {
      if (!this.updating) return;
      this.cancelRequested = true;
      terminateGIFWorker();
      this.progress = 0;
    },
    async updatePreview() {
      try {
        this.updating = true;
        this.cancelRequested = false;
        this.progress = 0;
        let blob;
        try {
          blob = await generateGIFInWorker(this.options, {
            onProgress: (progress) => {
              this.progress = progress;
            },
          });
        } catch (workerError) {
          if (this.cancelRequested || this.isGenerationCanceled(workerError)) {
            return;
          }
          const response = await fetch(this.url);
          blob = await response.blob();
          console.warn(
            "GIF worker generation failed; fell back to server",
            workerError
          );
        }
        this.file = new File([blob], this.filename, { type: "image/gif" });
        this.fileSize = humanStorageSize(this.file.size);
        this.preview = URL.createObjectURL(blob);
      } catch (error) {
        if (!this.isGenerationCanceled(error)) {
          this.notifyError(error);
        }
      } finally {
        this.progress = 0;
        this.updating = false;
        this.cancelRequested = false;
      }
    },
    updateRangePreview() {
      const suggestionsByFrame = this.options.suggestionsByFrame || [];
      const evaluationsByFrame = this.options.evaluationsByFrame || [];
      const startFrameIndex = this.options.plies?.length ? 1 : 0;
      const endFrameIndex = this.options.plies?.length || 0;
      const optionsStart = {
        ...this.options,
        plies: this.options.plies[0],
        suggestions: suggestionsByFrame[startFrameIndex] || null,
        evaluation: evaluationsByFrame[startFrameIndex] || null,
        wdl: (this.options.wdlsByFrame || [])[startFrameIndex] || null,
      };
      const optionsEnd = {
        ...this.options,
        suggestions: suggestionsByFrame[endFrameIndex] || null,
        evaluation: evaluationsByFrame[endFrameIndex] || null,
        wdl: (this.options.wdlsByFrame || [])[endFrameIndex] || null,
      };
      delete optionsStart.suggestionsByFrame;
      delete optionsEnd.suggestionsByFrame;
      delete optionsStart.evaluationsByFrame;
      delete optionsEnd.evaluationsByFrame;
      delete optionsStart.wdlsByFrame;
      delete optionsEnd.wdlsByFrame;

      TPStoPNG(optionsStart).toBlob((blob) => {
        this.previewStart = URL.createObjectURL(blob);
      });
      TPStoPNG(optionsEnd).toBlob((blob) => {
        this.previewEnd = URL.createObjectURL(blob);
      });
    },
    loadPreview() {
      const img = this.$refs.preview;
      this.dimensions =
        img.naturalWidth + " &times; " + img.naturalHeight + " px";
      this.$nextTick(() => this.measurePreview());
    },
    measurePreview() {
      if (this.$refs.previewContainer) {
        this.previewContainerHeight = this.$refs.previewContainer.offsetHeight;
      }
    },
    reset() {
      this.prompt({
        title: this.$t("Confirm"),
        message: this.$t("confirm.resetGIF"),
        success: () => {
          const config = cloneDeep(this.$store.state.ui.defaults.gifConfig);
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
    async download() {
      try {
        this.downloading = true;
        if (!this.file) {
          await this.updatePreview();
        }
        if (this.file) {
          await this.$store.dispatch("ui/DOWNLOAD_FILES", this.file);
          this.close();
        }
      } catch (error) {
        this.notifyError(error);
      } finally {
        this.downloading = false;
      }
    },
    share() {
      this.$store.dispatch("ui/SHARE", {
        title: "GIF",
        text: this.url,
      });
    },
    close() {
      this.cancelGeneration();
      this.$refs.dialog.hide();
    },
  },
  watch: {
    config: {
      handler: debounce(function (config) {
        this.$store.dispatch("ui/SET_UI", ["gifConfig", cloneDeep(config)]);
        this.updateRangePreview();
      }, 150),
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
    this.updateConfig();
  },
};
</script>

<style lang="scss">
.gif-generate-cancel {
  position: absolute;
  top: 50%;
  right: 8px;
  transform: translateY(-50%);
  z-index: 2;
}
</style>
