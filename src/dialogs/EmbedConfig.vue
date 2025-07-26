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
          <q-item-label>{{ $t("Disable Board") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle v-model="config.ui.disableBoard" />
        </q-item-section>
      </q-item>

      <q-item
        tag="label"
        :disable="config.ui.disableBoard"
        :ripple="!config.ui.disableBoard"
      >
        <q-item-section>
          <q-item-label>{{ $t("Disable Stone Cycling") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle
            v-model="config.ui.disableStoneCycling"
            :disable="config.ui.disableBoard"
          />
        </q-item-section>
      </q-item>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Disable Navigation") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle v-model="config.ui.disableNavigation" />
        </q-item-section>
      </q-item>

      <q-item
        tag="label"
        :disable="config.ui.disableNavigation"
        :ripple="!config.ui.disableNavigation"
      >
        <q-item-section>
          <q-item-label>{{ $t("Disable Undo") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle
            v-model="config.ui.disableUndo"
            :disable="config.ui.disableNavigation"
          />
        </q-item-section>
      </q-item>

      <q-item
        tag="label"
        :disable="config.ui.disableNavigation"
        :rippl="!config.ui.disableNavigation"
      >
        <q-item-section>
          <q-item-label>{{ $t("Play Controls") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle
            v-model="config.ui.showControls"
            :disable="config.ui.disableNavigation"
          />
        </q-item-section>
      </q-item>

      <q-item
        tag="label"
        :disable="config.ui.disableNavigation || !config.ui.showControls"
        :ripple="!config.ui.disableNavigation && config.ui.showControls"
      >
        <q-item-section>
          <q-item-label>{{ $t("Play Button") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle
            v-model="config.ui.showPlayButton"
            :disable="config.ui.disableNavigation || !config.ui.showControls"
          />
        </q-item-section>
      </q-item>

      <q-item
        tag="label"
        :disable="
          config.ui.disableNavigation ||
          !config.ui.showControls ||
          !config.ui.showPlayButton
        "
        :ripple="
          !config.ui.disableNavigation &&
          config.ui.showControls &&
          config.ui.showPlayButton
        "
      >
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

      <q-item
        tag="label"
        :disable="config.ui.disableNavigation"
        :ripple="config.ui.disableNavigation"
      >
        <q-item-section>
          <q-item-label>{{ $t("Scrub Bar") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle
            v-model="config.ui.showScrubber"
            :disable="config.ui.disableNavigation"
          />
        </q-item-section>
      </q-item>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Disable Notes") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle v-model="config.ui.disableText" />
        </q-item-section>
      </q-item>
      <q-item
        tag="label"
        :disable="config.ui.disableText"
        :ripple="config.ui.disableText"
      >
        <q-item-section>
          <q-item-label>{{ $t("Show Notes") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle
            v-model="config.ui.showText"
            :disable="config.ui.disableText"
          />
        </q-item-section>
      </q-item>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Disable PTN") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle v-model="config.ui.disablePTN" />
        </q-item-section>
      </q-item>

      <q-item
        tag="label"
        :disable="config.ui.disablePTN"
        :ripple="!config.ui.disablePTN"
      >
        <q-item-section>
          <q-item-label>{{ $t("Show PTN") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle
            v-model="config.ui.showPTN"
            :disable="config.ui.disablePTN"
          />
        </q-item-section>
      </q-item>

      <q-item
        tag="label"
        :disable="config.ui.disablePTN"
        :ripple="!config.ui.disablePTN"
      >
        <q-item-section>
          <q-item-label>{{ $t("Current Move") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle
            v-model="config.ui.showMove"
            :disable="config.ui.disablePTN"
          />
        </q-item-section>
      </q-item>

      <q-item
        tag="label"
        :disable="config.ui.disablePTN"
        :ripple="!config.ui.disablePTN"
      >
        <q-item-section>
          <q-item-label>{{ $t("Show All Branches") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle
            v-model="config.ui.showAllBranches"
            :disable="config.ui.disablePTN"
          />
        </q-item-section>
      </q-item>

      <q-item
        tag="label"
        :disable="config.ui.disablePTN"
        :ripple="!config.ui.disablePTN"
      >
        <q-item-section>
          <q-item-label>{{ $t("Disable PTN Tools") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle
            v-model="config.ui.disablePTNTools"
            :disable="config.ui.disablePTN"
          />
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

      <q-item
        tag="label"
        :disable="!config.ui.turnIndicator"
        :ripple="config.ui.turnIndicator"
      >
        <q-item-section>
          <q-item-label>{{ $t("Player Names") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle
            v-model="config.includeNames"
            :disable="!config.ui.turnIndicator"
          />
        </q-item-section>
      </q-item>

      <q-item
        tag="label"
        :disable="!config.ui.turnIndicator"
        :ripple="config.ui.turnIndicator"
      >
        <q-item-section>
          <q-item-label>{{ $t("Flat Counts") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle
            v-model="config.ui.flatCounts"
            :disable="!config.ui.turnIndicator"
          />
        </q-item-section>
      </q-item>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Move Number") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle v-model="config.ui.moveNumber" />
        </q-item-section>
      </q-item>

      <q-item
        tag="label"
        :disable="!config.ui.moveNumber"
        :ripple="config.ui.moveNumber"
      >
        <q-item-section>
          <q-item-label>{{ $t("Evaluation Text") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle
            v-model="config.ui.evalText"
            :disable="!config.ui.moveNumber"
          />
        </q-item-section>
      </q-item>

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

      <q-item
        tag="label"
        :disable="!config.ui.unplayedPieces"
        :ripple="config.ui.unplayedPieces"
      >
        <q-item-section>
          <q-item-label>{{ $t("Vertical Layout") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle
            v-model="config.ui.verticalLayout"
            :disable="!config.ui.unplayedPieces"
          />
        </q-item-section>
      </q-item>
      <q-item
        tag="label"
        :disable="!config.ui.unplayedPieces || !config.ui.verticalLayout"
        :ripple="config.ui.unplayedPieces"
      >
        <q-item-section>
          <q-item-label>{{ $t("Vertical Layout Auto") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle
            v-model="config.ui.verticalLayoutAuto"
            :disable="!config.ui.unplayedPieces || !config.ui.verticalLayout"
          />
        </q-item-section>
      </q-item>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Board Preferences Button") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle v-model="config.ui.showBoardPrefsBtn" />
        </q-item-section>
      </q-item>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Board Transform Button") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle v-model="config.ui.showBoardTransformBtn" />
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
