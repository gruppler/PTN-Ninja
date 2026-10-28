<template>
  <span
    >{{ name
    }}<span v-if="version" class="bot-version">{{ version }}</span></span
  >
</template>

<script>
// An engine's name, with its version after it in smaller type
export default {
  name: "BotName",
  props: {
    name: String,
    version: String,
  },
};
</script>

<style lang="scss" scoped>
.bot-version {
  font-size: 0.75em;
  opacity: 0.7;
  margin-left: 0.5em;
}
</style>
