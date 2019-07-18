<template>
  <div class="chat column no-wrap">
    <div class="col-grow relative-position">
      <q-scroll-area class="absolute-fit">
        <div ref="log">
          <div class="q-pa-md">
            <template v-for="(message, i) in messages">
              <q-chat-message
                v-if="!message.ply"
                :key="i"
                :text="message.text"
                :bg-color="bgColor(message)"
                :text-color="textColor(message)"
                :stamp="relativeTime(message)"
                :title="absoluteTime(message)"
                :sent="wasSent(message)"
                text-sanitize
              />
              <template v-if="message.ply">
                <q-separator class="q-mt-md" v-if="i > 0" :key="i" />
                <div
                  ref="plies"
                  class="fullwidth-padded-md q-py-xs q-mb-md"
                  :class="{
                    'q-mt-md': i > 0,
                    highlight: game.state.plyID === message.ply.id
                  }"
                  :key="i"
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
        :placeholder="$t('Message')"
        :dark="player === 2"
        dense
        rounded
        autogrow
        outlined
        :standout="
          player === 1 ? 'bg-grey-2 text-accent' : 'bg-secondary text-accent'
        "
      >
        <template v-slot:append>
          <q-btn
            @click="send"
            icon="send"
            :color="player === 1 ? 'grey-8' : 'white'"
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
  name: "Chat",
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
      return this.game.chatlog;
    },
    player() {
      return this.game.state.player;
    },
    time() {
      return this.game.datetime;
    },
    messages() {
      let messages = [];
      let previous;
      for (let plyID in this.log) {
        if (plyID >= 0) {
          messages.push({ ply: this.game.plies[plyID] });
        }
        for (var i = 0; i < this.log[plyID].length; i++) {
          let message = this.parseMessage(this.log[plyID][i]);
          if (
            previous &&
            message.player === previous.player &&
            Math.abs(message.time - previous.time) < 3e4
          ) {
            previous.time = message.time;
            previous.text = previous.text.concat(message.text);
          } else {
            messages[plyID < 0 ? "unshift" : "push"](message);
            previous = message;
          }
        }
      }
      return messages;
    },
    currentPlyIndex() {
      let ply;
      let index = 0;
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
      return index;
    }
  },
  methods: {
    updateTimer() {
      window.clearTimeout(this.timer);
      this.timer = window.setTimeout(() => {
        this.$forceUpdate();
        this.updateTimer();
      }, 3e4);
    },
    parseMessage(comment) {
      let { time, player, message } = comment;
      return {
        time: time ? new Date(time * 1e3 + this.time) : null,
        player: player ? 1 * player : null,
        text: [message]
      };
    },
    getTime() {
      return Math.floor((new Date().getTime() - this.time) / 1e3);
    },
    bgColor(message) {
      return message.player == 1 ? "white" : "secondary";
    },
    textColor(message) {
      return message.player == 2 ? "white" : "";
    },
    relativeTime(message) {
      if (message.time) {
        return this.$moment(new Date(message.time)).fromNow();
      }
    },
    absoluteTime(message) {
      if (message.time) {
        return this.$moment(new Date(message.time)).calendar();
      }
    },
    wasSent(message) {
      return message.player == this.player;
    },
    send() {
      if (this.message) {
        this.game.addChatMessage(
          `+${this.getTime()}:${this.player}: ${this.message}`
        );
        this.$store.dispatch("UPDATE_PTN", this.game.text());
        this.message = "";
        this.$refs.input.focus();
        this.updateTimer();
      }
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
    this.updateTimer();
  },
  beforeDestroy() {
    window.clearTimeout(this.timer);
  }
};
</script>

<style lang="stylus"></style>
