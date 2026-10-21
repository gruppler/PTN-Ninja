<template>
  <small-dialog
    v-model="show"
    content-class="non-selectable"
    storage-key="Changelog"
    v-bind="$attrs"
    go-back
  >
    <template v-slot:header>
      <dialog-header
        :icon="'changelog'"
        :title="$t('Changelog')"
        :subtitle="$t('Version {version}', { version })"
        color="primary"
      />
    </template>

    <div>
      <div v-if="!releases.length" class="text-center text-grey q-pa-lg">
        {{ $t("No changes to show yet.") }}
      </div>

      <template v-else>
        <template v-if="newReleases.length">
          <div class="text-overline text-primary q-mx-sm q-mb-sm">
            {{ $t("New since your last update") }}
          </div>
          <ReleaseCard
            v-for="release in newReleases"
            :key="release.version"
            :release="release"
            :is-latest="release.version === latestVersion"
            highlight
          />
        </template>

        <template v-if="previousReleases.length">
          <q-separator />
          <q-expansion-item
            v-model="previousExpanded"
            icon="recent"
            :label="$t('Previous releases')"
          >
            <ReleaseCard
              v-for="release in visiblePreviousReleases"
              :key="release.version"
              :release="release"
              :is-latest="release.version === latestVersion"
            />
            <div
              v-if="hasMorePreviousReleases"
              class="row justify-center q-my-md"
            >
              <q-btn
                color="primary"
                outline
                :label="$t('Load more')"
                @click="loadMorePrevious"
              />
            </div>
          </q-expansion-item>
        </template>
      </template>
    </div>

    <template v-slot:footer>
      <q-separator />
      <q-card-actions align="right">
        <q-checkbox
          v-model="showAfterUpdate"
          :label="$t('Show after update')"
          class="q-mr-auto"
          color="primary"
          dense
        />
        <q-btn :label="$t('Close')" color="primary" flat v-close-popup />
      </q-card-actions>
    </template>
  </small-dialog>
</template>

<script>
import ReleaseCard from "../components/ChangelogReleaseCard";
import {
  APP_VERSION,
  getChangelog,
  getSessionLastSeenVersion,
  markVersionSeen,
} from "../utils/changelog";

const PREVIOUS_PAGE_SIZE = 5;

export default {
  name: "Changelog",
  components: { ReleaseCard },
  data() {
    return {
      show: true,
      previousExpanded: false,
      visiblePreviousCount: PREVIOUS_PAGE_SIZE,
    };
  },
  computed: {
    hasMorePreviousReleases() {
      return this.visiblePreviousCount < this.previousReleases.length;
    },
    version() {
      return APP_VERSION;
    },
    releases() {
      return getChangelog({ lastSeenVersion: this.lastSeenVersion });
    },
    newReleases() {
      return this.releases.filter((release) => release.isNew);
    },
    previousReleases() {
      return this.releases.filter((release) => !release.isNew);
    },
    visiblePreviousReleases() {
      return this.previousReleases.slice(0, this.visiblePreviousCount);
    },
    latestVersion() {
      return this.releases.length ? this.releases[0].version : null;
    },
    // Pinned for the session, so re-opening the dialog does not collapse the
    // "New since your last update" split that mounting just marked as seen.
    lastSeenVersion() {
      return getSessionLastSeenVersion();
    },
    showAfterUpdate: {
      get() {
        return this.$store.state.ui.showChangelogAfterUpdate;
      },
      set(value) {
        this.$store.dispatch("ui/SET_UI", ["showChangelogAfterUpdate", value]);
      },
    },
  },
  methods: {
    loadMorePrevious() {
      this.visiblePreviousCount = Math.min(
        this.visiblePreviousCount + PREVIOUS_PAGE_SIZE,
        this.previousReleases.length
      );
    },
  },
  mounted() {
    this.previousExpanded = !this.newReleases.length;
    markVersionSeen();
  },
};
</script>
