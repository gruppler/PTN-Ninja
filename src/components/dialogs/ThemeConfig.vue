<template>
  <small-dialog
    :value="value"
    @input="$emit('input', $event)"
    content-class="ui-settings non-selectable"
    v-bind="$attrs"
    seamless
  >
    <template v-slot:header>
      <dialog-header icon="settings">{{ $t("Theme") }}</dialog-header>
    </template>

    <q-card style="width: 300px">
      <q-card-section class="q-gutter-y-md">
        <q-input
          :label="$t('Name')"
          :rules="[uniqueName]"
          v-model="name"
          hide-bottom-space
          filled
        >
          <template v-slot:prepend>
            <q-icon name="file" />
          </template>
        </q-input>

        <q-separator />

        <q-input
          v-for="(color, name) in theme.colors"
          :key="name"
          filled
          v-model="theme.colors[name]"
          :rules="['anyColor']"
          :label="name"
          hide-bottom-space
        >
          <template v-slot:prepend>
            <q-icon name="color" />
          </template>

          <template v-slot:append>
            <q-btn :style="{ background: color }" round>
              <q-popup-proxy transition-show="scale" transition-hide="scale">
                <q-color v-model="theme.colors[name]" />
              </q-popup-proxy>
            </q-btn>
          </template>
        </q-input>
      </q-card-section>
    </q-card>

    <template v-slot:footer>
      <q-separator />
      <q-card-actions align="right">
        <q-btn @click="reset" :label="$t('Reset')" flat />
        <div class="col-grow" />
        <q-btn :label="$t('Close')" color="primary" flat v-close-popup />
      </q-card-actions>
    </template>
  </small-dialog>
</template>

<script>
import { cloneDeep } from "lodash";

import { BOARD_STYLES } from "../../themes";

export default {
  name: "ThemeConfig",
  props: ["value"],
  data() {
    const theme = this.$store.getters.theme();
    return {
      boardStyles: BOARD_STYLES,
      theme,
      name: theme.name,
    };
  },
  computed: {
    themes() {
      return this.$store.getters.themes;
    },
  },
  methods: {
    uniqueName(name) {
      return (
        name === this.theme.name ||
        !this.themes.find((theme) => theme.name === name)
      );
    },
    reset() {
      this.$store.dispatch("PROMPT", {
        title: this.$t("Confirm"),
        message: this.$t("confirm.resetTheme"),
        success: () => {
          this.theme = this.$store.getters.theme();
          this.name = this.theme.name;
        },
      });
    },
  },
  watch: {
    value(isVisible) {
      if (isVisible) {
        this.theme = this.$store.getters.theme();
        this.name = this.theme.name;
      }
    },
  },
};
</script>

<style lang="scss"></style>
