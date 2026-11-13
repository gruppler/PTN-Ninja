<template>
  <div class="import-button">
    <div class="import-button-row row no-wrap">
      <q-item class="col" @click="paste" v-ripple clickable>
        <q-item-section v-if="icon" avatar>
          <q-icon :name="icon" />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ label || $t("Import") }}</q-item-label>
        </q-item-section>
      </q-item>

      <!-- Copies something out, e.g. the current custom theme -->
      <template v-if="copyText">
        <q-separator vertical />
        <q-btn
          class="import-button-copy"
          @click="copy"
          icon="copy"
          :aria-label="copyLabel || $t('Copy')"
          flat
          square
          stretch
        >
          <hint>{{ copyLabel || $t("Copy") }}</hint>
        </q-btn>
      </template>
    </div>

    <!-- Shown when the clipboard can't be read or didn't hold anything valid -->
    <q-slide-transition>
      <div v-show="showInput">
        <q-input
          ref="input"
          type="textarea"
          style="font-family: 'Source Code Pro'"
          :placeholder="placeholder || $t('hint.pasteCode')"
          v-model="text"
          filled
          square
        />
        <message-output :error="error" content-class="q-ma-md" />
      </div>
    </q-slide-transition>
  </div>
</template>

<script>
// Reads text from the clipboard and hands it to `handler`, which throws an
// Error if the text is no good. When the clipboard can't be read, or its text
// is rejected, a textarea opens for pasting by hand, the way the theme editor's
// Import does.
export default {
  name: "ImportButton",
  props: {
    label: String,
    icon: { type: String, default: "clipboard" },
    placeholder: String,
    // When set, a square button beside the row copies this text
    copyText: String,
    copyLabel: String,
    handler: { type: Function, required: true },
  },
  data() {
    return {
      showInput: false,
      text: "",
      error: "",
    };
  },
  methods: {
    async paste() {
      let text = "";
      try {
        text = await this.$store.dispatch("ui/PASTE");
      } catch (error) {
        console.error(error);
      }
      if (text && (await this.run(text))) {
        return;
      }
      this.text = text || "";
      if (!this.showInput) {
        this.showInput = true;
        this.$nextTick(() => this.$refs.input && this.$refs.input.focus());
      }
    },
    copy() {
      this.$store.dispatch("ui/COPY", { text: this.copyText });
    },
    // Whether the handler accepted the text
    async run(text) {
      this.error = "";
      try {
        await this.handler(text);
        this.text = "";
        this.showInput = false;
        return true;
      } catch (error) {
        this.error = error;
        return false;
      }
    },
  },
  watch: {
    text(text) {
      if (text) {
        this.run(text);
      } else {
        this.error = "";
      }
    },
  },
};
</script>

<style lang="scss">
.import-button-copy {
  aspect-ratio: 1;
  min-width: 48px;
}
</style>
