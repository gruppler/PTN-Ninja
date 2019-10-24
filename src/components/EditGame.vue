<template>
  <q-dialog
    :value="value"
    @input="$emit('input', $event)"
    no-backdrop-dismiss
    no-route-dismiss
  >
    <q-card style="width: 500px" class="bg-secondary" dark>
      <q-card-section class="q-gutter-y-md column">
        <q-input
          v-model="name"
          :label="$t('Title')"
          @keyup.enter="save"
          color="accent"
          dark
          filled
        >
          <template v-slot:append>
            <q-btn
              v-show="name !== generatedName"
              @click="name = generatedName"
              icon="refresh"
              dense
              flat
            />
          </template>
        </q-input>

        <div class="row">
          <div class="col q-gutter-y-md">
            <q-input
              v-model="tags.player1"
              :label="$t('Player1')"
              @keyup.enter="save"
              color="accent"
              dark
              filled
            >
              <template v-slot:prepend>
                <q-icon name="person" />
              </template>
            </q-input>

            <q-input
              v-model="tags.player2"
              :label="$t('Player2')"
              @keyup.enter="save"
              color="accent"
              dark
              filled
            >
              <template v-slot:prepend>
                <q-icon name="person_outline" />
              </template>
            </q-input>
          </div>
          <q-btn @click="swapPlayers" icon="swap_vert" dense flat />
        </div>

        <div v-if="showAll || tags.date || tags.time" class="row q-gutter-x-md">
          <q-input
            class="col-grow"
            v-model="tags.date"
            :label="$t('Date')"
            @keyup.enter="save"
            mask="####.##.##"
            color="accent"
            dark
            filled
          >
            <template v-slot:prepend>
              <q-icon name="event" />
            </template>
            <q-popup-proxy ref="qDateProxy">
              <q-date
                @input="() => $refs.qDateProxy.hide()"
                v-model="tags.date"
                mask="YYYY.MM.DD"
                color="accent"
                text-color="grey-10"
                today-btn
                dark
              />
            </q-popup-proxy>
          </q-input>

          <q-input
            class="col-grow"
            v-model="tags.time"
            :label="$t('Time')"
            @keyup.enter="save"
            mask="##:##:##"
            color="accent"
            dark
            filled
          >
            <template v-slot:prepend>
              <q-icon name="access_time" />
            </template>
            <q-popup-proxy ref="qTimeProxy">
              <q-time
                @input="() => $refs.qTimeProxy.hide()"
                v-model="tags.time"
                color="accent"
                text-color="grey-10"
                format24h
                with-seconds
                now-btn
                dark
              />
            </q-popup-proxy>
          </q-input>
        </div>
      </q-card-section>
      <q-separator dark />
      <q-card-actions align="right">
        <q-btn :label="$t('OK')" @click="save" flat />
        <q-btn :label="$t('Cancel')" flat v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
export default {
  name: "EditGame",
  props: ["value", "game"],
  data() {
    return {
      showAll: true,
      name: "",
      tags: {
        player1: null,
        player2: null,
        date: null,
        time: null,
        result: null,
        event: null,
        site: null,
        round: null,
        rating1: null,
        rating2: null,
        tps: null,
        points: null,
        clock: null
      }
    };
  },
  computed: {
    generatedName() {
      return this.game.generateName(this.tags);
    }
  },
  methods: {
    close() {
      this.$emit("input", false);
    },
    save() {
      this.name = (this.name || "").trim();
      if (this.game.name !== this.name) {
        if (!this.name) {
          this.name = this.game.generateName();
        }
        this.name = this.$store.getters.uniqueName(this.name, true);
        this.game.name = this.name;
      }

      let changedTags = {};
      Object.keys(this.tags).forEach(key => {
        const value = (this.tags[key] || "").trim();
        if (value !== this.game.tag(key)) {
          changedTags[key] = value;
        }
      });
      if (Object.keys(changedTags).length) {
        this.game.setTags(changedTags);
        this.updateTags();
      }

      this.close();
    },
    swapPlayers() {
      [this.tags.player1, this.tags.player2] = [
        this.tags.player2,
        this.tags.player1
      ];
    },
    updateTags() {
      Object.keys(this.tags).forEach(key => {
        this.tags[key] = this.game.tag(key);
      });
    }
  },
  watch: {
    value(isVisible) {
      if (isVisible) {
        this.name = this.game.name;
        this.updateTags();
      }
    }
  }
};
</script>

<style></style>
