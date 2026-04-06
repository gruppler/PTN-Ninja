<template>
  <q-btn
    icon="menu_vertical"
    @click.stop.prevent
    @click.right.prevent.stop
    stretch
    dense
    flat
  >
    <q-menu transition-show="none" transition-hide="none" auto-close square>
      <q-list>
        <q-item @click="$emit('share')" clickable>
          <q-item-section side>
            <q-icon name="share" />
          </q-item-section>
          <q-item-section>
            <q-item-label>
              {{ $t("Share") }}
            </q-item-label>
          </q-item-section>
        </q-item>
        <q-item @click="$emit('info')" clickable>
          <q-item-section side>
            <q-icon name="info" />
          </q-item-section>
          <q-item-section>
            <q-item-label>
              {{ $t("View Game Info") }}
            </q-item-label>
          </q-item-section>
        </q-item>
        <q-item @click="$emit('edit')" clickable>
          <q-item-section side>
            <q-icon name="edit" />
          </q-item-section>
          <q-item-section>
            <q-item-label>
              {{ $t("Edit Game") }}
            </q-item-label>
          </q-item-section>
        </q-item>
        <q-item @click="$emit('duplicate')" clickable>
          <q-item-section side>
            <q-icon name="copy" />
          </q-item-section>
          <q-item-section>
            <q-item-label>
              {{ $t("Duplicate") }}
            </q-item-label>
          </q-item-section>
        </q-item>
        <q-separator />
        <q-item @click="$emit('settings')" clickable>
          <q-item-section side>
            <q-icon name="ui_preferences" />
          </q-item-section>
          <q-item-section>
            <q-item-label>
              {{ $t("UI Preferences") }}
            </q-item-label>
          </q-item-section>
        </q-item>
        <q-item @click="$emit('help')" clickable>
          <q-item-section side>
            <q-icon name="help" />
          </q-item-section>
          <q-item-section>
            <q-item-label>
              {{ $t("Help") }}
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-menu>
  </q-btn>
</template>

<script>
export default {
  name: "MainMenu",
};
</script>
