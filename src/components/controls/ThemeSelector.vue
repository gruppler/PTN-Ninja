<template>
  <q-select
    :label="$t('Theme')"
    v-model="theme"
    :options="themes"
    transition-show="none"
    transition-hide="none"
    :virtual-scroll-item-size="84"
    map-options
    emit-value
    v-bind="$attrs"
  >
    <template v-for="(_, slot) of $scopedSlots" v-slot:[slot]="scope">
      <slot :name="slot" v-bind="scope" />
    </template>

    <template v-slot:append>
      <q-icon
        v-if="editButton"
        @click.stop="$router.push({ name: 'theme' })"
        name="edit"
        class="q-field__focusable-action"
      />
    </template>

    <template v-slot:option="scope">
      <ThemeSelectorOption
        :option="scope.opt"
        @remove="remove"
        :is-current="
          scope.opt.value === theme ||
          scope.opt.value === $store.state.ui.themeID
        "
        v-bind="scope.itemProps"
        v-on="scope.itemEvents"
      />
    </template>
  </q-select>
</template>

<script>
import ThemeSelectorOption from "./ThemeSelectorOption";

import { cloneDeep } from "lodash";

export default {
  name: "ThemeSelector",
  components: { ThemeSelectorOption },
  props: {
    value: String,
    editButton: Boolean,
    config: Object,
  },
  data() {
    return {
      thumbnailHeight: 0,
      previews: {},
    };
  },
  computed: {
    themes() {
      return Object.freeze(
        this.$store.getters["ui/themes"].map((theme, index) => ({
          value: theme.id,
          label: theme.name,
          index,
          theme,
        }))
      );
    },
    theme: {
      get() {
        return this.value;
      },
      set(value) {
        this.$emit("input", value);
      },
    },
  },
  methods: {
    remove(id) {
      if (id === this.theme) {
        return false;
      }
      const themes = cloneDeep(this.$store.state.ui.themes);
      let index = themes.findIndex((theme) => theme.id === id);
      if (index < 0) {
        return false;
      }
      const theme = cloneDeep(themes.splice(index, 1)[0]);
      this.$store.dispatch("ui/SET_UI", ["themes", themes]);
      this.$store.dispatch("ui/NOTIFY", {
        icon: "color",
        message: this.$t("success.themeRemoved", theme),
        timeout: 5000,
        progress: true,
        multiLine: false,
        actions: [
          {
            label: this.$t("Undo"),
            color: "primary",
            handler: () => {
              themes.splice(index, 0, theme);
              this.$store.dispatch("ui/SET_UI", ["themes", themes]);
            },
          },
          { icon: "close" },
        ],
      });
    },
  },
};
</script>
