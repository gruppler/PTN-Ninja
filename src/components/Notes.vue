<template>
  <div class="notes column no-wrap">
    <div class="col-grow relative-position">
      <q-scroll-area class="absolute-fit">
        <div class="q-pa-md">
          <div
            v-if="log[-1]"
            ref="messages"
            class="fullwidth-padded-md q-py-xs q-mb-md"
            :class="{ highlight: !game.state.plyID && !game.state.plyIsDone }"
            key="-1"
          >
            <q-chat-message
              key="preface"
              :text="log[-1].map(comment => comment.message)"
              bg-color="accent"
              text-color="grey-10"
              text-sanitize
            />
          </div>
          <template v-for="(comments, plyID) in log">
            <div
              v-if="plyID >= 0"
              ref="messages"
              class="fullwidth-padded-md q-py-xs q-mb-md"
              :class="{ highlight: game.state.plyID == plyID }"
              :key="plyID"
            >
              <div>
                <Linenum
                  v-if="game.plies[plyID].move.linenum"
                  :linenum="game.plies[plyID].move.linenum"
                  :game="game"
                />
                <Ply :ply="game.plies[plyID]" :game="game" :delay="500" />
              </div>

              <q-chat-message
                :key="plyID + '-messages'"
                :text="comments.map(comment => comment.message)"
                bg-color="accent"
                text-color="grey-10"
                text-sanitize
              />
            </div>
          </template>
        </div>
      </q-scroll-area>
    </div>
    <div>
      <q-separator />
      <q-input
        ref="input"
        @keydown.shift.enter.prevent="send"
        class="col-grow q-pa-sm items-end"
        v-model="message"
        :placeholder="$t('Note')"
        dense
        rounded
        autogrow
        outlined
        standout="bg-accent text-secondary"
      >
        <template v-slot:append>
          <q-btn
            @click="send"
            icon="add"
            :disabled="!message.length"
            flat
            dense
            round
          />
        </template>
      </q-input>
    </div>
  </div>
</template>

<script>
import Linenum from "./Linenum";
import Ply from "./Ply";

export default {
  name: "Notes",
  components: { Ply, Linenum },
  props: ["game"],
  data() {
    return {
      message: "",
      timer: null
    };
  },
  computed: {
    log() {
      return this.game.notes;
    },
    currentPlyIndex() {
      if (!this.game.state.plyID && !this.game.state.plyIsDone) {
        return 0;
      } else if (this.game.state.ply) {
        let ids = Object.keys(this.log)
          .map(id => 1 * id)
          .sort();
        for (let i = 0; i < ids.length; i++) {
          if (ids[i] === this.game.state.plyID) {
            return i;
          } else if (ids[i] > this.game.state.plyID) {
            return i - !!i;
          }
        }
      }
      return 0;
    }
  },
  methods: {
    send() {
      this.game.addNote(this.message);
      this.$store.dispatch("UPDATE_PTN", this.game.text());
      this.message = "";
      this.$refs.input.focus();
    },
    scroll(smooth) {
      const message = this.$refs.messages[this.currentPlyIndex];
      if (message) {
        message.scrollIntoView({
          behavior: smooth ? "smooth" : "auto",
          block: "start"
        });
      }
    }
  },
  watch: {
    game() {
      this.scroll();
    },
    currentPlyIndex() {
      this.scroll(true);
    }
  },
  mounted() {
    this.scroll();
  }
};
</script>

<style lang="stylus"></style>
