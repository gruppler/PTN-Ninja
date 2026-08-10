<template>
  <q-list
    class="changelog-release"
    :class="{ 'changelog-release--highlight': highlight }"
    dense
  >
    <q-item>
      <q-item-section>
        <q-item-label class="text-bold">
          {{ $t("Version {version}", { version: release.version }) }}
          <q-badge v-if="isLatest" color="primary" :label="$t('Latest')" />
        </q-item-label>
      </q-item-section>
      <q-item-section v-if="formattedDate" side>
        <q-item-label class="text-bold">
          {{ formattedDate }}
        </q-item-label>
      </q-item-section>
    </q-item>

    <q-item v-for="(change, index) in release.changes" :key="index">
      <q-item-section avatar style="min-width: 36px">
        <q-icon :name="typeMeta(change).icon" size="20px">
          <tooltip>{{ $t(typeMeta(change).label) }}</tooltip>
        </q-icon>
      </q-item-section>
      <q-item-section>
        <q-item-label class="changelog-change-text">
          {{ change.description }}
        </q-item-label>
      </q-item-section>
    </q-item>
  </q-list>
</template>

<script>
import { CHANGE_TYPES } from "../utils/changelog";
import { format } from "date-fns";

const FALLBACK_TYPE = { label: "Changed", icon: "edit", color: "grey" };

export default {
  name: "ChangelogReleaseCard",
  props: {
    release: { type: Object, required: true },
    isLatest: Boolean,
    highlight: Boolean,
  },
  computed: {
    formattedDate() {
      if (!this.release.date) return "";
      const parsed = new Date(this.release.date + "T00:00:00");
      return isNaN(parsed.getTime())
        ? this.release.date
        : format(parsed, "MMMM d, yyyy");
    },
  },
  methods: {
    typeMeta(change) {
      return CHANGE_TYPES[change.type] || FALLBACK_TYPE;
    },
  },
};
</script>

<style lang="scss" scoped>
.changelog-release {
  padding-left: 11px;
  &--highlight {
    padding-left: 8px;
    border-left: 3px solid var(--q-color-primary);
  }
}
.changelog-change-text {
  user-select: text;
}
</style>
