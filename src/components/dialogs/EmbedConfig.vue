<template>
  <large-dialog
    :value="value"
    @input="$emit('input', $event)"
    no-backdrop-dismiss
    min-height="588"
    v-bind="$attrs"
  >
    <template v-slot:header>
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
    </template>

    <q-list>
      <q-item>
        <q-item-section>
          <q-input
            v-model="name"
            name="name"
            :label="$t('Name')"
            color="accent"
            filled
          >
            <template v-slot:append>
              <q-icon
                @click="name = name === game.name ? generatedName : game.name"
                name="refresh"
                class="cursor-pointer"
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

      <q-item>
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

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Include Player Names") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle color="accent" v-model="config.includeNames" />
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

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Show Notes") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle color="accent" v-model="config.ui.showText" />
        </q-item-section>
      </q-item>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Show PTN") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle color="accent" v-model="config.ui.showPTN" />
        </q-item-section>
      </q-item>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Show All Branches") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle color="accent" v-model="config.ui.showAllBranches" />
        </q-item-section>
      </q-item>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Axis Labels") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle color="accent" v-model="config.ui.axisLabels" />
        </q-item-section>
      </q-item>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Road Connections") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle color="accent" v-model="config.ui.showRoads" />
        </q-item-section>
      </q-item>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Highlight Squares") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle color="accent" v-model="config.ui.highlightSquares" />
        </q-item-section>
      </q-item>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Flat Counts") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle color="accent" v-model="config.ui.flatCounts" />
        </q-item-section>
      </q-item>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Unplayed Pieces") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle color="accent" v-model="config.ui.unplayedPieces" />
        </q-item-section>
      </q-item>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Current Move") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle color="accent" v-model="config.ui.showMove" />
        </q-item-section>
      </q-item>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Play Controls") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle color="accent" v-model="config.ui.showControls" />
        </q-item-section>
      </q-item>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Scrub Bar") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle color="accent" v-model="config.ui.showScrubber" />
        </q-item-section>
      </q-item>
    </q-list>

    <template v-slot:footer>
      <q-separator />
      <q-card-actions align="right">
        <q-btn :label="$t('Reset')" @click="reset" flat />
        <div class="col-grow" />
        <q-btn :label="$t('Cancel')" color="accent" flat v-close-popup />
        <q-btn
          :label="$t('Copy')"
          @click="copy"
          color="accent"
          flat
          v-close-popup
        />
      </q-card-actions>
    </template>
  </large-dialog>
</template>

<script>
import { cloneDeep } from "lodash";

export default {
  name: "EmbedConfig",
  props: ["value", "game"],
  data() {
    return {
      name: this.game.name,
      config: cloneDeep(this.$store.state.embedConfig),
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
        names: this.config.includeNames,
        state: this.config.state,
        ui: this.config.ui
      });
    },
    code() {
      return `<iframe src="${this.url}" width="${this.config.width}" height="${this.config.height}" style="width:${this.config.width}; max-width:calc(100vw - 30px); height:${this.config.height}; max-height:100vh;" frameborder="0" allowfullscreen />`;
    }
  },
  methods: {
    reset() {
      this.$store.getters.confirm({
        title: this.$t("Confirm"),
        message: this.$t("confirm.resetEmbed"),
        success: () => {
          this.config = cloneDeep(this.$store.state.defaults.embedConfig);
        }
      });
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
