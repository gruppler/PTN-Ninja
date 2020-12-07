<template>
  <large-dialog
    :value="value"
    @input="$emit('input', $event)"
    no-backdrop-dismiss
    :min-height="588"
    v-bind="$attrs"
  >
    <img
      ref="preview"
      class="block"
      :src="preview"
      @load="loadPreview"
      width="100%"
      frameborder="0"
      allowfullscreen
    />

    <q-list>
      <q-item>
        <q-item-section>
          <q-item-label>
            <span class="float-right" v-html="dimensions" />
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
          <q-item-label>{{ $t("Include Player Names") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle color="accent" v-model="config.includeNames" />
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
          <q-item-label>{{ $t("Flat Counts") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle color="accent" v-model="config.flatCounts" />
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
    </q-list>

    <template v-slot:footer>
      <q-separator />
      <q-card-actions align="right">
        <q-btn :label="$t('Reset')" @click="reset" flat />
        <div class="col-grow" />
        <q-btn :label="$t('Download')" @click="download" flat />
        <q-btn :label="$t('Share')" @click="share" flat />
        <q-btn :label="$t('Close')" color="accent" flat v-close-popup />
      </q-card-actions>
    </template>
  </large-dialog>
</template>

<script>
import { pngUIOptions } from "../../store/ui/state";
import { cloneDeep } from "lodash";

export default {
  name: "PNGConfig",
  props: ["value", "game"],
  data() {
    const sizes = ["xs", "sm", "md", "lg", "xl"];
    return {
      config: cloneDeep(this.$store.state.pngConfig),
      preview: "",
      dimensions: "",
      size: sizes.indexOf(this.$store.state.pngConfig.size),
      sizes
    };
  },
  computed: {
    url() {
      return this.$store.getters.png_url(this.game);
    },
    tps() {
      return this.game.state.tps;
    }
  },
  methods: {
    updateConfig() {
      this.config = cloneDeep(this.$store.state.pngConfig);
    },
    updatePreview() {
      this.preview = this.game.render(this.config).toDataURL();
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
          Object.keys(config).forEach(key => {
            if (pngUIOptions.includes(key)) {
              config[key] = this.$store.state[key];
            }
          });
          this.config = config;
          this.size = this.sizes.indexOf(config.size);
        }
      });
    },
    download() {
      this.$store.dispatch("SAVE_PNG", this.game);
    },
    share() {
      this.$store.dispatch("COPY", {
        title: this.url,
        url: this.url,
        text: this.url
      });
    },
    close() {
      this.$emit("input", false);
    }
  },
  watch: {
    tps() {
      this.updatePreview();
    },
    config: {
      handler(config) {
        this.$store.dispatch("SET_UI", ["pngConfig", cloneDeep(config)]);
        this.updatePreview();
      },
      deep: true
    },
    size(i) {
      this.config.size = this.sizes[i];
    },
    value(show) {
      if (show) {
        this.updatePreview();
      }
    }
  },
  created() {
    this.updatePreview();
  }
};
</script>
