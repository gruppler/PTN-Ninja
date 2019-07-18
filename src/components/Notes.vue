<template>
  <div class="notes column no-wrap">
    <div class="col-grow relative-position">
      <q-scroll-area class="absolute-fit">
        <div ref="log">
          <div class="q-pa-md">
            <template v-for="(message, i) in messages">
              <q-chat-message
                v-if="!message.ply"
                :key="i"
                :text="message.text"
                bg-color="accent"
                text-color="grey-10"
                text-sanitize
              />
              <template v-if="message.ply">
                <q-separator
                  class="q-mt-md"
                  v-if="i > 0"
                  :key="'separator' + i"
                />
                <div
                  ref="plies"
                  class="fullwidth-padded-md q-py-xs q-mb-md"
                  :class="{
                    'q-mt-md': i > 0,
                    highlight: game.state.plyID === message.ply.id
                  }"
                  :key="'ply' + i"
                >
                  <Linenum
                    v-if="message.ply.move.linenum"
                    :linenum="message.ply.move.linenum"
                    :game="game"
                  />
                  <Ply :ply="message.ply" :game="game" :delay="500" />
                </div>
              </template>
            </template>
          </div>
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
import { scroll } from "quasar";

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
    messages() {
      let messages = [];
      for (let plyID in this.log) {
        if (plyID >= 0) {
          messages.push({ ply: this.game.plies[plyID] });
          messages.push({
            text: this.log[plyID].map(comment => comment.message)
          });
        } else {
          messages.unshift({
            text: this.log[plyID].map(comment => comment.message)
          });
        }
      }
      return messages;
    },
    currentPlyIndex() {
      let index = -1;
      if (this.game.state.ply) {
        let ply;
        for (let plyID in this.log) {
          ply = this.game.plies[plyID];
          if (!ply) {
            continue;
          }
          if (ply.index === this.game.state.ply.index) {
            return index;
          } else if (index && ply.index > this.game.state.ply.index) {
            return index - 1;
          }
          index++;
        }
      }
      return index;
    }
  },
  methods: {
    send() {
      this.game.addNote(this.message);
      this.$store.dispatch("UPDATE_PTN", this.game.text());
      this.message = "";
      this.$refs.input.focus();
    },
    scroll(duration = 0) {
      this.$nextTick(() => {
        if (this.$refs.plies && this.currentPlyIndex in this.$refs.plies) {
          const el = this.$refs.plies[this.currentPlyIndex];
          const target = scroll.getScrollTarget(el);
          const offset = el.offsetTop;
          scroll.setScrollPosition(target, offset, duration);
        }
      });
    }
  },
  watch: {
    currentPlyIndex() {
      this.scroll(150);
    }
  },
  mounted() {
    this.scroll();
  }
};
</script>

<style lang="stylus"></style>
