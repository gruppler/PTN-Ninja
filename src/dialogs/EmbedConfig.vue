<template>
  <large-dialog
    ref="dialog"
    :value="true"
    no-backdrop-dismiss
    :min-height="588"
    v-bind="$attrs"
  >
    <template v-slot:header>
      <dialog-header icon="embed">{{ $t("Embed") }}</dialog-header>
    </template>

    <div class="relative-position">
      <iframe
        ref="preview"
        class="block"
        v-show="!previewError"
        @load="previewLoaded = true"
        @error="previewError = true"
        :src="initialURL"
        width="100%"
        :height="previewHeight"
        frameborder="0"
        allowfullscreen
      />
      <q-inner-loading :showing="!previewLoaded && !previewError" />
    </div>

    <q-separator />

    <q-list>
      <q-item>
        <q-item-section>
          <q-input v-model="name" name="name" :label="$t('Name')" filled>
            <template v-slot:append>
              <q-icon
                @click="name = name === gameName ? generatedName : gameName"
                name="refresh"
                class="q-field__focusable-action"
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
            filled
          />
        </q-item-section>

        <q-item-section>
          <q-input
            v-model="config.height"
            :label="$t('Height')"
            hide-bottom-space
            filled
          />
        </q-item-section>
      </q-item>

      <ThemeSelector
        v-model="config.ui.themeID"
        :config="$store.state.ui.embedConfig.ui"
        item-aligned
        edit-button
        filled
      />

      <q-item>
        <q-item-section>
          {{ $t("Play Speed") }}
          <q-slider
            v-model="config.ui.playSpeed"
            :min="30"
            :max="160"
            :label-value="config.ui.playSpeed + ' ' + $t('FPM')"
            :step="10"
            snap
            label
          />
        </q-item-section>
      </q-item>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Start from Current Position") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle v-model="config.state" />
        </q-item-section>
      </q-item>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Show Notes") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle v-model="config.ui.showText" />
        </q-item-section>
      </q-item>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Show PTN") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle v-model="config.ui.showPTN" />
        </q-item-section>
      </q-item>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Show All Branches") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle v-model="config.ui.showAllBranches" />
        </q-item-section>
      </q-item>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Axis Labels") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle v-model="config.ui.axisLabels" />
        </q-item-section>
      </q-item>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Road Connections") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle v-model="config.ui.showRoads" />
        </q-item-section>
      </q-item>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Turn Indicator") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle v-model="config.ui.turnIndicator" />
        </q-item-section>
      </q-item>

      <smooth-reflow>
        <div v-if="config.ui.turnIndicator">
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
              <q-toggle v-model="config.ui.flatCounts" />
            </q-item-section>
          </q-item>
        </div>
      </smooth-reflow>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Stack Counts") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle v-model="config.ui.stackCounts" />
        </q-item-section>
      </q-item>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Highlight Squares") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle v-model="config.ui.highlightSquares" />
        </q-item-section>
      </q-item>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Unplayed Pieces") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle v-model="config.ui.unplayedPieces" />
        </q-item-section>
      </q-item>

      <smooth-reflow>
        <q-item
          v-if="config.ui.turnIndicator && config.ui.unplayedPieces"
          tag="label"
          v-ripple
        >
          <q-item-section>
            <q-item-label>{{ $t("Move Number") }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-toggle v-model="config.ui.moveNumber" />
          </q-item-section>
        </q-item>
      </smooth-reflow>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Current Move") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle v-model="config.ui.showMove" />
        </q-item-section>
      </q-item>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Play Controls") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle v-model="config.ui.showControls" />
        </q-item-section>
      </q-item>

      <smooth-reflow>
        <q-item v-if="config.ui.showControls" tag="label" v-ripple>
          <q-item-section>
            <q-item-label>{{ $t("Play Button") }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-toggle v-model="config.ui.showPlayButton" />
          </q-item-section>
        </q-item>
      </smooth-reflow>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Scrub Bar") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle v-model="config.ui.showScrubber" />
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
          :label="$t(canShare ? 'Share' : 'Copy')"
          color="primary"
          @click="share"
          v-close-popup
        />
      </q-card-actions>
    </template>
  </large-dialog>
</template>

<script>
import ThemeSelector from "../components/controls/ThemeSelector";
import { cloneDeep } from "lodash";
import { generateName } from "../Game/base";

export default {
  name: "EmbedConfig",
  components: { ThemeSelector },
  data() {
    return {
      name: "",
      url: "",
      config: cloneDeep(this.$store.state.ui.embedConfig),
      previewError: false,
      previewLoaded: false,
      initialURL: "",
    };
  },
  computed: {
    previewHeight() {
      return this.previewError ? "0" : "333px";
    },
    gameName() {
      return this.$store.state.game.name;
    },
    generatedName() {
      let tags = { ...this.$store.state.game.ptn.tags };
      if (!this.config.includeNames) {
        tags.player1 = "";
        tags.player2 = "";
      }
      return generateName(tags);
    },
    code() {
      return `<iframe src="${this.url}" width="${this.config.width}" height="${this.config.height}" style="width:${this.config.width}; max-width:calc(100vw - 30px); height:${this.config.height}; max-height:100vh;" frameborder="0" allowfullscreen></iframe>`;
    },
    canShare() {
      return this.$store.state.nativeSharing;
    },
  },
  methods: {
    postMessage(action, value) {
      if (this.$refs.preview) {
        this.$refs.preview.contentWindow.postMessage({ action, value });
      }
    },
    updateURL() {
      this.url = this.$store.getters["ui/url"](this.$game, {
        origin: true,
        name: this.name,
        names: this.config.includeNames,
        state: this.config.state,
        ui: this.config.ui,
      });
    },
    reset() {
      this.prompt({
        title: this.$t("Confirm"),
        message: this.$t("confirm.resetEmbed"),
        success: () => {
          const config = cloneDeep(this.$store.state.ui.defaults.embedConfig);
          config.ui.themeID = this.$store.state.ui.themeID;
          config.ui.theme = this.$store.state.ui.theme;
          this.config = config;
        },
      });
    },
    share() {
      this.$store.dispatch("ui/SHARE", {
        title: this.$t("Embed") + " – " + this.name,
        text: this.code,
      });
    },
    close() {
      this.$refs.dialog.hide();
    },
  },
  watch: {
    name(value) {
      this.postMessage("SET_NAME", value);
      this.updateURL();
    },
    "config.ui.themeID"(themeID) {
      this.config.ui.theme = this.$store.getters["ui/theme"](themeID);
    },
    "config.includeNames"(value) {
      this.postMessage("SHOW_NAMES", value);
    },
    "config.state"(value) {
      if (value) {
        this.postMessage("GO_TO_PLY", {
          plyID: this.$game.board.plyID,
          isDone: this.$game.board.plyIsDone,
        });
      } else {
        this.postMessage("FIRST");
      }
    },
    "config.ui": {
      handler(value) {
        this.postMessage("SET_UI", value);
      },
      deep: true,
    },
    config: {
      handler(value) {
        this.$store.dispatch("ui/SET_UI", ["embedConfig", cloneDeep(value)]);
        this.updateURL();
      },
      deep: true,
    },
  },
  mounted() {
    this.name = this.gameName;
    this.initialURL = this.$store.getters["ui/url"](this.$game, {
      origin: true,
      name: this.name,
      names: true,
      state: this.config.state,
      ui: this.config.ui,
    });
    this.updateURL();
    if (!this.config.includeNames) {
      const hideNames = () => {
        this.postMessage("SHOW_NAMES", false);
        this.$refs.preview.contentWindow.removeEventListener("load", hideNames);
      };
      this.$nextTick(() => {
        this.$refs.preview.contentWindow.addEventListener("load", hideNames);
      });
    }
  },
};
</script>
