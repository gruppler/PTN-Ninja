<template>
  <large-dialog
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
                @click="name = name === game.name ? generatedName : game.name"
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
        v-model="config.ui.theme"
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
            :label-value="config.ui.playSpeed + ' ' + $t('BPM')"
            :step="10"
            snap
            label
          />
        </q-item-section>
      </q-item>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Start at Current Position") }}</q-item-label>
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
        <div v-show="config.ui.turnIndicator">
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
          <q-item-label>{{ $t("Highlight Squares") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle v-model="config.ui.highlightSquares" />
        </q-item-section>
      </q-item>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Piece Shadows") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle v-model="config.ui.pieceShadows" />
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
        <q-btn :label="$t(canShare ? 'Share' : 'Copy')" @click="share" flat />
        <q-btn :label="$t('Close')" color="primary" flat v-close-popup />
      </q-card-actions>
    </template>
  </large-dialog>
</template>

<script>
import ThemeSelector from "../components/controls/ThemeSelector";
import { cloneDeep } from "lodash";

export default {
  name: "EmbedConfig",
  components: { ThemeSelector },
  data() {
    return {
      name: "",
      config: cloneDeep(this.$store.state.ui.embedConfig),
      previewError: false,
      previewLoaded: false,
      initialURL: "",
    };
  },
  computed: {
    game() {
      return this.$store.state.game.current;
    },
    previewHeight() {
      return this.previewError ? "0" : "333px";
    },
    generatedName() {
      return this.game.generateName();
    },
    url() {
      return this.$store.getters["ui/url"](this.game, {
        origin: true,
        name: this.name,
        names: this.config.includeNames,
        state: this.config.state,
        ui: this.config.ui,
      });
    },
    code() {
      return `<iframe src="${this.url}" width="${this.config.width}" height="${this.config.height}" style="width:${this.config.width}; max-width:calc(100vw - 30px); height:${this.config.height}; max-height:100vh;" frameborder="0" allowfullscreen />`;
    },
    canShare() {
      return navigator.canShare;
    },
  },
  methods: {
    reset() {
      this.$store.dispatch("ui/PROMPT", {
        title: this.$t("Confirm"),
        message: this.$t("confirm.resetEmbed"),
        success: () => {
          this.config = cloneDeep(this.$store.state.ui.defaults.embedConfig);
          this.config.ui.theme = this.$store.state.ui.theme.id;
        },
      });
    },
    share() {
      this.$store.dispatch("ui/COPY", {
        title: this.$t("Embed") + " – " + this.name,
        text: this.code,
      });
    },
    close() {
      this.$router.back();
    },
  },
  watch: {
    url(url) {
      if (this.$refs.preview) {
        this.$refs.preview.contentWindow.location.replace(url);
      }
    },
    config: {
      handler(value) {
        this.$store.dispatch("ui/SET_UI", ["embedConfig", cloneDeep(value)]);
      },
      deep: true,
    },
  },
  mounted() {
    this.name = this.game.name;
    this.initialURL = this.url;
  },
};
</script>
