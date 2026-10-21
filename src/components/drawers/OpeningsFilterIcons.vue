<template>
  <span class="q-gutter-xs">
    <q-icon v-if="dbSettings.includeBotGames" name="bot">
      <tooltip>{{ $t("analysis.includeBotGames") }}</tooltip>
    </q-icon>
    <q-icon
      v-if="dbSettings.player1 && dbSettings.player1.length"
      name="player1"
    >
      <tooltip>{{ dbSettings.player1.join(", ") }}</tooltip>
    </q-icon>
    <q-icon
      v-if="dbSettings.player2 && dbSettings.player2.length"
      name="player2"
    >
      <tooltip>{{ dbSettings.player2.join(", ") }}</tooltip>
    </q-icon>
    <q-icon v-if="Number.isFinite(dbSettings.minRating)" name="rating1">
      <tooltip>{{ dbSettings.minRating }}</tooltip>
    </q-icon>
    <q-icon v-if="dbSettings.komi && dbSettings.komi.length" name="komi">
      <tooltip>
        {{ $t("Komi") }}
        {{ dbSettings.komi.join(", ").replace(/0?\.5/g, "½") }}
      </tooltip>
    </q-icon>
    <q-icon
      v-if="dbSettings.tournament !== null"
      :name="dbSettings.tournament ? 'event' : 'event_outline'"
    >
      <tooltip>{{
        $t(
          "analysis.tournamentOptions." +
            (dbSettings.tournament ? "only" : "exclude")
        )
      }}</tooltip>
    </q-icon>
    <q-icon v-if="dbSettings.minDate" name="date_arrow_right">
      <tooltip>
        {{ $t("analysis.minDate") }}
        <relative-date :value="new Date(dbSettings.minDate)" text-only />
      </tooltip>
    </q-icon>
    <q-icon v-if="dbSettings.maxDate" name="date_arrow_left">
      <tooltip>
        {{ $t("analysis.maxDate") }}
        <relative-date :value="new Date(dbSettings.maxDate)" text-only />
      </tooltip>
    </q-icon>
  </span>
</template>

<script>
export default {
  name: "OpeningsFilterIcons",
  computed: {
    dbSettings() {
      return this.$store.state.analysis.dbSettings;
    },
  },
};
</script>
