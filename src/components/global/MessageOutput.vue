<template>
  <smooth-reflow>
    <div v-if="error" class="row no-wrap text-negative" :class="contentClass">
      <q-icon name="error" size="sm" left />
      {{ formatError(error) }}
    </div>
    <div v-if="success" class="row no-wrap text-positive" :class="contentClass">
      <q-icon name="success" size="sm" left />
      {{ formatSuccess(success) }}
    </div>
    <div v-if="warning" class="row no-wrap text-warning" :class="contentClass">
      <q-icon name="warning" size="sm" left />
      {{ formatWarning(warning) }}
    </div>
    <div v-if="hint" class="row no-wrap" :class="contentClass">
      {{ formatHint(hint) }}
    </div>
  </smooth-reflow>
</template>

<script>
export default {
  name: "message-output",
  props: ["error", "success", "warning", "hint", "content-class"],
  methods: {
    formatError(error) {
      const errorMessages = this.$i18n.messages[this.$i18n.locale].error;
      if (typeof error === "string") {
        if (error in errorMessages) {
          return this.$t(`error["${error}"]`);
        } else {
          return error;
        }
      } else if ("code" in error && error.code in errorMessages) {
        return this.$t(`error["${error.code}"]`);
      } else if ("message" in error) {
        if (error.message in errorMessages) {
          return this.$t(`error["${error.message}"]`);
        } else {
          return error.message;
        }
      }
    },
    formatSuccess(success) {
      const successMessages = this.$i18n.messages[this.$i18n.locale].success;
      if (typeof success === "string") {
        if (success in successMessages) {
          return this.$t(`success["${success}"]`);
        } else {
          return success;
        }
      }
    },
    formatWarning(warning) {
      const warningMessages = this.$i18n.messages[this.$i18n.locale].warning;
      if (typeof warning === "string") {
        if (warning in warningMessages) {
          return this.$t(`warning["${warning}"]`);
        } else {
          return warning;
        }
      }
    },
    formatHint(hint) {
      const warningMessages = this.$i18n.messages[this.$i18n.locale].hint;
      if (typeof hint === "string") {
        if (hint in warningMessages) {
          return this.$t(`hint["${hint}"]`);
        } else {
          return hint;
        }
      }
    }
  }
};
</script>
