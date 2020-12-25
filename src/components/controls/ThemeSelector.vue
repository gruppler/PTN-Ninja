<template>
  <q-select
    :label="$t('Theme')"
    v-model="theme"
    :options="themes"
    popup-content-class="bg-accent"
    item-aligned
    option-value="id"
    option-label="name"
    behavior="menu"
    map-options
    emit-value
    filled
  >
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
        <q-item-section>
          <q-item-label>{{ scope.opt.name }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-btn
            v-if="!scope.opt.isBuiltIn"
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
import { cloneDeep } from "lodash";
import { HOTKEYS } from "../../keymap";

export default {
  name: "ThemeSelector",
  props: {
    value: String,
    "edit-button": Boolean,
  },
  computed: {
    themes() {
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
  },
  methods: {
    remove(id) {
      const themes = cloneDeep(this.$store.state.themes);
      const index = themes.findIndex((theme) => theme.id === id);
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
