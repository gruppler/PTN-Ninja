<template>
  <q-btn
    icon="menu_vertical"
    @click.stop.prevent
    @click.right.prevent.stop
    :dense="$q.screen.lt.md"
    stretch
    flat
  >
    <q-menu transition-show="none" transition-hide="none" auto-close square>
      <q-list>
        <!-- <q-item @click="$emit('share')" clickable>
          <q-item-section side>
            <q-icon name="share" />
          </q-item-section>
          <q-item-section>
            <q-item-label>
              {{ $t("Share") }}
            </q-item-label>
          </q-item-section>
        </q-item> -->
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
        <q-item @click="$emit('check-updates')" clickable>
          <q-item-section side>
            <q-icon name="update" />
          </q-item-section>
          <q-item-section>
            <q-item-label>
              {{ $t("Check for updates") }}
            </q-item-label>
          </q-item-section>
        </q-item>
        <q-item @click="$emit('changelog')" clickable>
          <q-item-section side>
            <q-icon name="changelog" />
          </q-item-section>
          <q-item-section>
            <q-item-label>
              {{ $t("Changelog") }}
            </q-item-label>
            <q-item-label caption>
              {{ $t("Version {version}", { version: appVersion }) }}
            </q-item-label>
          </q-item-section>
          <q-item-section v-if="hasUnseenChangelog" side>
            <q-badge color="primary" rounded />
          </q-item-section>
        </q-item>
      </q-list>
    </q-menu>
  </q-btn>
</template>

<script>
import {
  APP_VERSION,
  getLastSeenVersion,
  hasUnseenChanges,
} from "../../utils/changelog";

export default {
  name: "MainMenu",
  computed: {
    appVersion() {
      return APP_VERSION;
    },
    // Live rather than session-pinned: unlike the dialog's split, the badge
    // should clear as soon as the changelog is opened.
    hasUnseenChangelog() {
      return hasUnseenChanges({ lastSeenVersion: getLastSeenVersion() });
    },
  },
};
</script>
