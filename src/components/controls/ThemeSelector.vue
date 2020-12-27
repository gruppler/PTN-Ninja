<template>
  <q-select
    :label="$t('Theme')"
    v-model="theme"
    :options="themes"
    popup-content-class="bg-accent"
    option-value="id"
    option-label="name"
    map-options
    emit-value
    v-bind="$attrs"
  >
    <template v-slot:prepend v-if="preview">
      <q-avatar rounded>
        <img :src="preview" />
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
        <q-item-section v-if="scope.opt.preview" side>
          <q-avatar rounded>
            <img :src="scope.opt.preview" />
          </q-avatar>
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ scope.opt.name }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-btn
            v-if="
              !scope.opt.isBuiltIn &&
              scope.opt.id !== theme &&
              scope.opt.id !== $store.state.themeID
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
import { cloneDeep, pick } from "lodash";
import { HOTKEYS } from "../../keymap";

export default {
  name: "ThemeSelector",
  props: {
    value: String,
    game: Object,
    "edit-button": Boolean,
  },
  computed: {
    themes() {
      if (this.game) {
        const config = cloneDeep(
          pick(this.$store.state, Object.keys(this.$store.state.pngConfig))
        );
        config.size = "xs";
        return this.$store.getters.themes.map((theme) => {
          theme = cloneDeep(theme);
          const canvas = this.game.render({ ...config, theme });
          theme.preview = canvas.toDataURL();
          return theme;
        });
      }
      return this.$store.getters.themes;
    },
    theme: {
      get() {
        return this.value;
      },
      set(value) {
        this.$emit("input", value);
      },
    },
    preview() {
      const theme = this.themes.find((theme) => theme.id === this.value);
      return theme ? theme.preview : null;
    },
  },
  methods: {
    remove(id) {
      if (id === this.theme) {
        return false;
      }
      const themes = cloneDeep(this.$store.state.themes);
      const builtInThemeCount = this.themes.length - themes.length;
      let index = themes.findIndex((theme) => theme.id === id);
      if (index < 0) {
        return false;
      }
      const theme = cloneDeep(themes.splice(index, 1)[0]);
      this.$store.dispatch("SET_UI", ["themes", themes]);
      this.$store.dispatch("NOTIFY", {
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
              this.$store.dispatch("SET_UI", ["themes", themes]);
            },
          },
          { icon: "close" },
        ],
      });
    },
  },
};
</script>
