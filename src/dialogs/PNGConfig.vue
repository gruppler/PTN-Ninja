<template>
  <large-dialog
    ref="dialog"
    :value="true"
    no-backdrop-dismiss
    :min-height="588"
    v-bind="$attrs"
  >
    <template v-slot:header>
      <dialog-header icon="png">{{ $t("Configure PNG") }}</dialog-header>
    </template>

    <smooth-reflow>
      <img
        ref="preview"
        class="block"
        :src="preview"
        @load="loadPreview"
        width="100%"
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

      <q-item
        tag="label"
        :disable="!config.turnIndicator"
        :ripple="config.turnIndicator"
      >
        <q-item-section>
          <q-item-label>{{ $t("Player Names") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle
            v-model="config.includeNames"
            :disable="config.turnIndicator"
          />
        </q-item-section>
      </q-item>

      <q-item
        tag="label"
        :disable="!config.turnIndicator"
        :ripple="config.turnIndicator"
      >
        <q-item-section>
          <q-item-label>{{ $t("Flat Counts") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle
            v-model="config.flatCounts"
            :disable="config.turnIndicator"
          />
        </q-item-section>
      </q-item>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Stack Counts") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle v-model="config.stackCounts" />
        </q-item-section>
      </q-item>

      <q-item
        tag="label"
        :disable="!config.turnIndicator || !config.unplayedPieces"
        :ripple="config.turnIndicator && config.unplayedPieces"
      >
        <q-item-section>
          <q-item-label>{{ $t("Move Number") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle
            v-model="config.moveNumber"
            :disable="!config.turnIndicator || !config.unplayedPieces"
          />
        </q-item-section>
      </q-item>

      <q-item
        tag="label"
        :disable="!config.turnIndicator || !config.unplayedPieces"
        :ripple="config.turnIndicator && config.unplayedPieces"
      >
        <q-item-section>
          <q-item-label>{{ $t("Evaluation Text") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle
            v-model="config.evalText"
            :disable="!config.turnIndicator || !config.unplayedPieces"
          />
        </q-item-section>
      </q-item>

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
import ThemeSelector from "../components/controls/ThemeSelector";
import { imgUIOptions } from "../store/ui/state";
import { TPStoPNG } from "tps-ninja";

import { cloneDeep, debounce } from "lodash";

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
      fileSize: "",
      imageSize: sizes.indexOf(this.$store.state.ui.pngConfig.imageSize),
      textSize: sizes.indexOf(this.$store.state.ui.pngConfig.textSize),
      sizes,
    };
  },
  computed: {
    game() {
      return this.$store.state.game;
    },
    canShare() {
      return this.$store.state.nativeSharing;
    },
  },
  methods: {
    updatePreview: debounce(function () {
      const config = cloneDeep(this.config);
      config.font = "Roboto";
      config.komi = this.game.config.komi;
      config.opening = this.game.config.opening;
      config.tps = this.game.position.tps;
      config.theme = this.$store.getters["ui/theme"](this.config.themeID);
      config.hlSquares =
        config.highlightSquares && !this.$store.state.ui.highlighterEnabled;
      config.transform = this.$store.state.ui.boardTransform;

      if (
        this.$store.state.ui.highlighterEnabled &&
        Object.keys(this.$store.state.ui.highlighterSquares).length
      ) {
        config.highlighter = this.$store.state.ui.highlighterSquares;
      }

      const ply = this.game.position.ply;
      if (ply) {
        if (this.game.position.plyIsDone) {
          config.ply =
            ply.text +
            (config.evalText && ply.evaluation ? ply.evaluation.text : "");
          config.tps = ply.tpsBefore;
        } else if (config.hlSquares) {
          config.hl = ply.text;
        }
      }

      // Add player names
      if (config.includeNames) {
        config.player1 = this.game.ptn.tags.player1;
        config.player2 = this.game.ptn.tags.player2;
      }

      // Generate image
      const filename = this.$store.getters["ui/pngFilename"]({
        name: this.game.name,
        plyID: this.game.position.plyID,
        plyIsDone: this.game.position.plyIsDone,
      });
      TPStoPNG(config).toBlob((blob) => {
        this.file = new File([blob], filename, { type: "image/png" });
        this.fileSize = humanStorageSize(this.file.size);
        this.preview = URL.createObjectURL(blob);
      });
    }),
    loadPreview() {
      const img = this.$refs.preview;
      this.dimensions =
        img.naturalWidth + " &times; " + img.naturalHeight + " px";
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
        text: this.$store.getters["ui/png_url"](this.$game),
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
