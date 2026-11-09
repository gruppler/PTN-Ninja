<template>
  <q-item
    @click="
      $router.push({
        name: 'settings',
        params: { category, section },
      })
    "
    clickable
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
// Opens the Settings dialog at a category, and optionally a section
export default {
  name: "SettingsLink",
  props: {
    category: { type: String, required: true },
    section: String,
  },
};
</script>
