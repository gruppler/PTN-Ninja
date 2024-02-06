<template>
  <large-dialog
    ref="dialog"
    :value="true"
    no-backdrop-dismiss
    :min-height="588"
    v-bind="$attrs"
  >
    <template v-slot:header>
      <dialog-header icon="gif">{{ $t("Configure GIF") }}</dialog-header>
    </template>

    <smooth-reflow>
      <img
        v-if="preview"
        ref="preview"
        class="block"
        :src="preview"
        @load="loadPreview"
        width="100%"
        frameborder="0"
        allowfullscreen
      />
    </smooth-reflow>
    <q-btn
      class="full-width no-border-radius"
      @click="updatePreview"
      :loading="updating"
      icon="refresh"
      :label="$t('Generate')"
      color="primary"
    />

    <q-list>
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
            :min="30"
            :max="160"
            :label-value="config.playSpeed + ' ' + $t('FPM')"
            :step="10"
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

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>
            {{ $t("Transparent Background") }}
          </q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle v-model="config.transparent" />
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
          <q-item-label>{{ $t("Stack Counts") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle v-model="config.stackCounts" />
        </q-item-section>
      </q-item>

      <smooth-reflow>
        <q-item
          v-if="config.turnIndicator && config.unplayedPieces"
          tag="label"
          v-ripple
        >
          <q-item-section>
            <q-item-label>{{ $t("Move Number") }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-toggle v-model="config.moveNumber" />
          </q-item-section>
        </q-item>
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
          :loading="downloading"
          color="primary"
        />
        <q-btn
          :label="$t(canShare ? 'Share URL' : 'Copy URL')"
          @click="share"
          color="primary"
          v-close-popup
        />
      </q-card-actions>
    </template>
  </large-dialog>
</template>

<script>
import ThemeSelector from "../components/controls/ThemeSelector";
import { imgUIOptions } from "../store/ui/state";
import { boardOnly } from "../themes";
import { PTNtoTPS } from "tps-ninja";

import { cloneDeep } from "lodash";

import { format } from "quasar";
const { humanStorageSize } = format;

export default {
  name: "GIFConfig",
  components: { ThemeSelector },
  data() {
    const sizes = ["xs", "sm", "md", "lg", "xl"];
    return {
      updating: false,
      downloading: false,
      progress: 0,
      config: cloneDeep(this.$store.state.ui.gifConfig),
      preview: "",
      dimensions: "",
      file: null,
      fileSize: "",
      imageSize: sizes.indexOf(this.$store.state.ui.gifConfig.imageSize),
      textSize: sizes.indexOf(this.$store.state.ui.gifConfig.textSize),
      sizes,
    };
  },
  computed: {
    game() {
      return this.$store.state.game;
    },
    branchPlies() {
      return this.game.ptn.branchPlies;
    },
    canShare() {
      return this.$store.state.nativeSharing;
    },
    options() {
      const options = cloneDeep(this.config);

      options.delay = Math.round(6e4 / options.playSpeed);
      options.plies = this.branchPlies
        .slice(options.plyRange.min, options.plyRange.max + 1)
        .map((ply) => ply.text);
      options.hlSquares = options.highlightSquares;
      options.transform = this.$store.state.ui.boardTransform;
      if (options.plyRange.min > 0) {
        options.tps = PTNtoTPS({
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

      // Theme
      let theme = this.$store.getters["ui/theme"](this.config.themeID);
      if (theme) {
        if (theme.isBuiltIn) {
          theme = theme.id;
        } else {
          theme = boardOnly(theme);
        }
        options.theme = theme;
      }

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
    async updatePreview() {
      try {
        this.updating = true;
        const response = await fetch(this.url);
        const blob = await response.blob();
        this.file = new File([blob], this.filename, { type: "image/gif" });
        this.fileSize = humanStorageSize(this.file.size);
        this.preview = URL.createObjectURL(blob);
      } catch (error) {
        this.notifyError(error);
      } finally {
        this.updating = false;
      }
    },
    loadPreview() {
      const img = this.$refs.preview;
      this.dimensions =
        img.naturalWidth + " &times; " + img.naturalHeight + " px";
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
      this.$refs.dialog.hide();
    },
  },
  watch: {
    config: {
      handler(config) {
        this.$store.dispatch("ui/SET_UI", ["gifConfig", cloneDeep(config)]);
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
    this.updateConfig();
  },
};
</script>
