<template>
  <div class="chat column no-wrap">
    <recess class="col-grow">
      <div class="absolute-fit scroll">
        <div class="q-px-md">
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
                  highlight: game.state.plyID === message.ply.id,
                }"
                :key="i"
              >
                <Linenum
                  v-if="message.ply.linenum"
                  :linenum="message.ply.linenum"
                  :game="game"
                />
                <Ply
                  class="text-no-wrap"
                  :plyID="message.ply.id"
                  :game="game"
                  :delay="6e4 / $store.state.playSpeed"
                />
              </div>
            </template>
          </template>
        </div>
      </div>
      <q-resize-observer @resize="scroll" />
    </recess>
    <div>
      <q-input
        ref="input"
        v-if="player"
        @keydown.shift.enter.prevent="send"
        @keydown.esc="$refs.input.blur()"
        debounce="50"
        class="footer-toolbar bg-secondary col-grow q-pa-sm items-end"
        v-model="message"
        :placeholder="$t('Message')"
        :dark="player === 2"
        dense
        rounded
        autogrow
        outlined
        color="accent"
        :bg-color="player === 1 ? 'white' : 'secondary'"
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
import Linenum from "../PTN/Linenum";
import Ply from "../PTN/Ply";

import { debounce } from "quasar";
import { format, formatDistanceToNow } from "date-fns";

export default {
  name: "Chat",
  components: { Ply, Linenum },
  props: ["game"],
  data() {
    return {
      message: "",
      timer: null,
    };
  },
  computed: {
    log() {
      return this.game.chatlog;
    },
    player() {
      const user = this.$store.state.online.user;
      return this.game.isLocal || !user
        ? this.game.state.player
        : this.game.player(user.uid);
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
        for (let i = 0; i < this.log[plyID].length; i++) {
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
      if (!this.game.state.plyID && !this.game.state.plyIsDone) {
        return 0;
      } else if (this.game.state.ply) {
        let ids = Object.keys(this.log)
          .map((id) => 1 * id)
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
    },
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
        text: [message],
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
        return formatDistanceToNow(message.time, { addSuffix: true });
      }
    },
    absoluteTime(message) {
      if (message.time) {
        return format(message.time, this.$t("format.date-time-full"));
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
        this.message = "";
        this.$refs.input.focus();
        this.updateTimer();
      }
    },
    scroll(smooth) {
      const message = this.$refs.messages
        ? this.$refs.messages[this.currentPlyIndex]
        : null;
      if (message) {
        message.scrollIntoView({
          behavior: smooth ? "smooth" : "auto",
          block: "start",
        });
      }
    },
  },
  watch: {
    currentPlyIndex() {
      this.scroll(true);
    },
  },
  created() {
    this.scroll = debounce(this.scroll, 100);
  },
  mounted() {
    this.scroll();
    this.updateTimer();
  },
  beforeDestroy() {
    window.clearTimeout(this.timer);
  },
};
</script>

<style lang="stylus">
.chat
  .notes
    .scroll:before
      content ""
      display block
      height 100%
</style>
