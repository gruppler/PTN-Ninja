<template>
  <div
    class="game-rules"
    :class="inline ? 'row no-wrap q-gutter-x-sm' : 'column'"
  >
    <span v-if="komi" class="text-no-wrap">
      <q-icon name="komi">
        <hint>{{ $t("Komi") }}</hint>
      </q-icon>
      {{ komi }}
    </span>
    <span v-if="isSpecialOpening" class="text-no-wrap">
      <q-icon name="opening">
        <hint>{{ $t("Opening") }}</hint>
      </q-icon>
      {{ $t("openings." + opening) }}
    </span>
  </div>
</template>

<script>
// Rules that differ from a standard game, like PlayTak's game history
export default {
  name: "GameRules",
  props: {
    komi: [Number, String],
    opening: String,
    inline: Boolean,
  },
  computed: {
    isSpecialOpening() {
      return Boolean(this.opening) && this.opening !== "swap";
    },
  },
};
</script>
