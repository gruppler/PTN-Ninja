<template>
  <q-card class="clickable" v-on:click="load_game()">
    <q-card-section>
      <div>
        <div>{{ white_player }} vs. {{ black_player }}</div>
        <div>({{ white_rating }}) vs. ({{ black_rating }})</div>
      </div>
      <div>{{ result }} Komi {{ komi }}</div>
      <div>
        {{ date.toISOString().split("T")[0] }}
        <span v-if="tournament">(tournament game)</span>
      </div>
    </q-card-section>
  </q-card>
</template>

<script>
export default {
  name: "DatabaseGame",

  props: {
    id: Number,
    white_player: String,
    black_player: String,
    white_rating: Number,
    black_rating: Number,
    ptn: String,
    playtak_id: Number,
    result: String,
    date: Date,
    komi: Number,
    tournament: Boolean,
  },

  methods: {
    async load_game() {
      let response = await fetch(
        `https://openings.exegames.de/api/v1/game/${this.playtak_id}`
      );

      if (response.ok) {
        let data = await response.json();
        console.log(data);
        let ninjatpn = data.ptn.split("\n");
        ninjatpn.splice(8, 2);
        ninjatpn = ninjatpn.join("\n");
        this.$store.dispatch("game/ADD_GAME", {
          ptn: ninjatpn,
          name: this.caption,
        });
      } else {
        alert("HTTP-Error: " + response.status);
      }
    },
  },
};
</script>

<style>
.clickable {
  cursor: pointer;
}
.clickable:hover {
  background-color: gray;
}
</style>
