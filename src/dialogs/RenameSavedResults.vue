<template>
  <q-dialog
    ref="dialog"
    :value="true"
    @hide="$emit('hide')"
    content-class="rename-saved-results"
    no-backdrop-dismiss
  >
    <q-card style="width: 300px">
      <q-select
        ref="input"
        :value="name"
        @input="setName"
        @input-value="setName"
        @filter="filter"
        @keyup.native.enter="save"
        :options="filteredOptions"
        :label="$t('analysis.engineName')"
        :hint="name.trim() ? '' : $t('analysis.engineNameHint')"
        :error="!isValid"
        :error-message="$t('error.Invalid engine name')"
        input-debounce="0"
        use-input
        hide-selected
        fill-input
        hide-dropdown-icon
        autofocus
        filled
      />

      <q-card-actions align="right">
        <q-btn :label="$t('Cancel')" color="primary" flat v-close-popup />
        <q-btn
          :label="$t('OK')"
          :disabled="!isValid"
          @click="save"
          color="primary"
          flat
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { sanitizeBotName } from "../Game/PTN/Comment";

export default {
  name: "RenameSavedResults",
  props: {
    // The engine whose saved results to rename; null is "Other"
    botName: {
      type: String,
      default: null,
    },
    positionCount: {
      type: Number,
      default: 0,
    },
  },
  data() {
    return {
      name: this.botName || "",
      query: "",
    };
  },
  computed: {
    savedBotNames() {
      return this.$store.getters["analysis/savedBotNames"];
    },
    options() {
      const names = new Set();
      this.savedBotNames.forEach((name) => name && names.add(name));
      this.$store.state.analysis.botList.forEach(
        (bot) => bot.label && names.add(bot.label)
      );
      names.delete(this.botName);
      return [...names].sort((a, b) => a.localeCompare(b));
    },
    filteredOptions() {
      const query = this.query.toLowerCase();
      return query
        ? this.options.filter((name) => name.toLowerCase().includes(query))
        : this.options;
    },
    newName() {
      return sanitizeBotName(this.name) || null;
    },
    isValid() {
      // Braces would end the PTN comment, so they can't be stored
      return !/[{}]/.test(this.name);
    },
  },
  methods: {
    setName(value) {
      this.name = value || "";
    },
    filter(query, update) {
      update(() => {
        this.query = query;
      });
    },
    close() {
      this.$refs.dialog.hide();
    },
    label(name) {
      return name || this.$t("Other");
    },
    save() {
      if (!this.isValid) {
        return;
      }
      const oldName = this.botName;
      const newName = this.newName;
      if (newName === oldName) {
        this.close();
        return;
      }
      const rename = () => {
        this.close();
        this.$store.dispatch("game/RENAME_BOT_ANALYSIS_NOTES", {
          oldName,
          newName,
        });
      };
      if (this.savedBotNames.includes(newName)) {
        this.prompt({
          title: this.$t("Confirm"),
          message: this.$tc("confirm.mergeSavedResults", this.positionCount, {
            from: this.label(oldName),
            to: this.label(newName),
          }),
          success: rename,
        });
      } else {
        rename();
      }
    },
  },
};
</script>
