<template>
  <q-select
    :label="$t('Theme')"
    v-model="theme"
    :options="themes"
    option-value="id"
    option-label="name"
    transition-show="none"
    transition-hide="none"
    map-options
    emit-value
    v-bind="$attrs"
  >
    <template v-slot:prepend>
      <q-avatar rounded>
        <img :src="previews[value]" />
      </q-avatar>
    </template>

    <template v-slot:append>
      <q-icon
        v-if="editButton"
        @click="$router.push({ name: 'theme' })"
        name="edit"
        class="q-field__focusable-action"
      />
    </template>

    <template v-slot:option="scope">
      <q-item
        class="non-selectable"
        v-bind="scope.itemProps"
        v-on="scope.itemEvents"
      >
        <q-item-section side>
          <img
            :src="previews[scope.opt.id]"
            :height="thumbnailHeight"
            class="rounded-borders"
          />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ scope.opt.name }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-btn
            v-if="
              !scope.opt.isBuiltIn &&
              scope.opt.id !== theme &&
              scope.opt.id !== $store.state.ui.themeID
            "
            @click.stop="remove(scope.opt.id)"
            icon="delete"
            flat
            dense
          />
        </q-item-section>
      </q-item>
    </template>
  </q-select>
</template>

<script>
import { cloneDeep, pick, without } from "lodash";
import { HOTKEYS } from "../../keymap";

export default {
  name: "ThemeSelector",
  props: {
    value: String,
    "edit-button": Boolean,
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
      return this.$store.getters["ui/themes"];
    },
    theme: {
      get() {
        return this.value;
      },
      set(value) {
        this.$emit("input", value);
      },
    },
    previewConfig() {
      const config = cloneDeep(
        this.config ||
          pick(
            this.$store.state.ui,
            without(
              Object.keys(this.$store.state.ui.pngConfig),
              "theme",
              "themeID"
            )
          )
      );
      config.imageSize = "xs";
      return config;
    },
  },
  methods: {
    updatePreviews() {
      if (!this.$game) {
        return;
      }
      this.$store.getters["ui/themes"].forEach((theme, i) => {
        const canvas = this.$game.render({ ...this.previewConfig, theme });
        this.previews[theme.id] = canvas.toDataURL();

        if (!i) {
          this.thumbnailHeight = canvas.height / 2;
        }
      });
    },
    remove(id) {
      if (id === this.theme) {
        return false;
      }
      const themes = cloneDeep(this.$store.state.ui.themes);
      const builtInThemeCount = this.themes.length - themes.length;
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
  created() {
    this.updatePreviews();
  },
  watch: {
    "$store.state.game.board": "updatePreviews",
    previewConfig: "updatePreviews",
  },
};
</script>
