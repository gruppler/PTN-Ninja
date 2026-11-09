<template>
  <q-item
    v-if="!$store.state.ui.embed"
    @click="
      $router.push({
        name: 'settings',
        params: { category, section },
      })
    "
    clickable
    v-close-popup
    v-ripple
  >
    <q-item-section avatar>
      <q-icon name="settings" />
    </q-item-section>
    <q-item-section>
      {{ $t("settings.All Settings") }}
    </q-item-section>
  </q-item>
</template>

<script>
// Opens the Settings dialog at a category, and optionally a section.
// Not shown in embeds, which don't expose the Settings dialog
export default {
  name: "SettingsLink",
  props: {
    category: { type: String, required: true },
    section: String,
  },
};
</script>
