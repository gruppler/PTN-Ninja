<template>
  <q-list class="settings-backup">
    <q-item @click="exportSettings" clickable v-ripple>
      <q-item-section avatar>
        <q-icon name="download" />
      </q-item-section>
      <q-item-section>
        <q-item-label>{{ $t("Export Settings") }}</q-item-label>
        <q-item-label caption>{{ $t("hint.exportSettings") }}</q-item-label>
      </q-item-section>
    </q-item>
    <q-item @click="chooseFile" clickable v-ripple>
      <q-item-section avatar>
        <q-icon name="upload" />
      </q-item-section>
      <q-item-section>
        <q-item-label>{{ $t("Import Settings") }}</q-item-label>
        <q-item-label caption>{{ $t("hint.importSettings") }}</q-item-label>
      </q-item-section>
    </q-item>
    <input
      ref="file"
      type="file"
      accept=".json,application/json"
      hidden
      @change="readFile"
    />
  </q-list>
</template>

<script>
import { exportFile, LocalStorage } from "quasar";
import {
  exportSettings,
  importSettings,
  parseSettings,
} from "../../settings/backup";
import { APP_VERSION } from "../../utils/changelog";

export default {
  name: "SettingsBackup",
  methods: {
    exportSettings() {
      const data = exportSettings(LocalStorage, { appVersion: APP_VERSION });
      const date = data.exportedAt.slice(0, 10);
      const ok = exportFile(
        `ptn-ninja-settings-${date}.json`,
        JSON.stringify(data, null, 2),
        "application/json"
      );
      if (ok !== true) {
        this.$store.dispatch("ui/NOTIFY_ERROR", "Unable to download");
      }
    },
    chooseFile() {
      this.$refs.file.value = "";
      this.$refs.file.click();
    },
    async readFile(event) {
      const file = event.target.files && event.target.files[0];
      if (!file) {
        return;
      }
      let text;
      try {
        text = await file.text();
        parseSettings(text);
      } catch (error) {
        this.$store.dispatch("ui/NOTIFY_ERROR", "Invalid settings file");
        return;
      }
      this.prompt({
        title: this.$t("Import Settings"),
        message: this.$t("confirm.importSettings"),
        ok: this.$t("Import"),
        success: () => this.importSettings(text),
      });
    },
    importSettings(text) {
      try {
        importSettings(LocalStorage, text);
      } catch (error) {
        this.$store.dispatch(
          "ui/NOTIFY_ERROR",
          error.code === 22 ? "localstorageFull" : "Invalid settings file"
        );
        return;
      }
      // The store loads the imported settings as it loads any stored ones
      window.location.reload();
    },
  },
};
</script>
