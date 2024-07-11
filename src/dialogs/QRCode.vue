<template>
  <q-dialog
    :value="true"
    ref="dialog"
    @show="show"
    @hide="hide"
    content-class="qr-code"
    v-bind="$attrs"
    :maximized="maximized"
    no-route-dismiss
  >
    <div class="flex-center column" @click="$refs.dialog.hide()">
      <img @click.stop ref="output" />
      <q-btn-toggle
        @click.stop
        v-model="linkType"
        :options="linkTypes"
        class="full-width"
        :style="{ background: bg }"
        spread
      />
    </div>
  </q-dialog>
</template>

<script>
import Qrious from "qrious";

const SIZE = 450;
const PADDING = 24;
const SCREEN = SIZE + PADDING * 2;

export default {
  name: "QRCode",
  props: {
    goBack: Boolean,
  },
  data() {
    return {
      link: "",
      linkType: "full",
      linkTypes: [
        {
          value: "full",
          label: this.$t("Full Link"),
          icon: "url",
        },
        {
          value: "short",
          label: this.$t("Short Link"),
          icon: "url_short",
        },
      ],
    };
  },
  computed: {
    maximized() {
      return this.$q.screen.width <= SCREEN || this.$q.screen.height <= SCREEN;
    },
    fg() {
      return this.$store.state.ui.theme.isDark ? "white" : "black";
    },
    bg() {
      return this.$store.state.ui.theme.isDark ? "black" : "white";
    },
  },
  methods: {
    show() {
      new Qrious({
        element: this.$refs.output,
        background: this.bg,
        foreground: this.fg,
        value: this.link,
        backgroundAlpha: 1,
        size: SIZE,
      });
    },
    hide() {
      if (this.goBack) {
        this.$router.back();
      }
    },
    async updateLink() {
      this.link =
        this.linkType === "full"
          ? this.$store.getters["ui/url"](this.$game, {
              origin: true,
              state: true,
            })
          : await this.$store.dispatch("ui/GET_SHORT_URL", {
              game: this.$game,
              options: {
                state: true,
              },
            });
      this.show();
    },
  },
  mounted() {
    this.updateLink();
  },
  watch: {
    linkType: "updateLink",
  },
};
</script>

<style lang="scss">
.qr-code {
  img {
    pointer-events: all;
    max-width: 100vmin;
    max-height: 100vmin;
  }
}
</style>
