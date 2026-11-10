<template>
  <div class="import-button">
    <q-item @click="paste" v-ripple clickable>
      <q-item-section v-if="icon" avatar>
        <q-icon :name="icon" />
      </q-item-section>
      <q-item-section>
        <q-item-label>{{ label || $t("Import") }}</q-item-label>
      </q-item-section>
    </q-item>

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
