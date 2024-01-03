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
              :name="names[message.player]"
              name-sanitize
              text-sanitize
            />
            <template v-if="message.ply">
              <q-separator class="q-mt-md" v-if="i > 0" :key="i" />
              <div
                ref="plies"
                class="fullwidth-padded-md q-py-xs q-mb-md"
                :class="{
                  'q-mt-md': i > 0,
                }"
                :key="i"
              >
                <Linenum
                  v-if="message.ply.linenum"
                  :linenum="message.ply.linenum"
                />
                <Ply
                  class="text-no-wrap"
                  :plyID="message.ply.id"
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
        class="footer-toolbar bg-ui col-grow q-pa-sm items-end"
        v-model="message"
        :placeholder="$t('Message')"
        :dark="player === 2"
        dense
        rounded
        autogrow
        outlined
        :bg-color="player === 1 ? 'player1' : 'player2'"
      >
        <template v-slot:append>
          <q-btn
            @click="send"
            icon="send"
            :color="player === 1 ? 'player2' : 'player1'"
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
import { throttle } from "lodash";
import { format, formatDistanceToNow } from "date-fns";

export default {
  name: "Chat",
  components: { Ply, Linenum },
  data() {
    return {
      message: "",
      timer: null,
    };
  },
  computed: {
    game() {
      return this.$store.state.game;
    },
    plies() {
      return this.game.ptn.allPlies;
    },
    log() {
      return this.game.comments.chatlog;
    },
    plyIDs() {
      return Object.freeze(
        Object.keys(this.log)
          .map((id) => 1 * id)
          .sort((a, b) => a - b)
      );
    },
    player() {
      const user = this.$store.state.online.user;
      return !this.game.config.isOnline || !user
        ? this.game.position.turn
        : this.game.config.player;
    },
    time() {
      return this.game.ptn.tags.datetime;
    },
    names() {
      return {
        1: this.game.tag("Player1") || "",
        2: this.game.tag("Player2") || "",
      };
    },
    messages() {
      let messages = [];
      let previous;
      for (let plyID in this.log) {
        if (plyID >= 0) {
          messages.push({ ply: this.plies[plyID] });
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
    currentPlyID() {
      if (!this.log) {
        return null;
      }
      let plyID, ply;
      if (!this.game.position.plyID && !this.game.position.plyIsDone) {
        return this.plyIDs[0];
      } else if (this.game.position.ply) {
        if (this.game.position.plyID in this.log) {
          return this.game.position.plyID;
        } else if (this.isCurrent(-1)) {
          return -1;
        } else {
          for (let i = this.plyIDs.length - 1; i >= 0; i--) {
            plyID = this.plyIDs[i];
            ply = plyID in this.plies ? this.plies[plyID] : null;
            if (
              ply &&
              this.branchPlies.includes(ply) &&
              ply.index < this.game.position.ply.index
            ) {
              return plyID;
            }
          }
          return this.plyIDs[0];
        }
      }
      return null;
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
      return "player" + message.player;
    },
    textColor(message) {
      return this.$store.state.theme[`player${message.player}Dark`]
        ? "white"
        : "black";
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
        // this.$game.addChatMessage(
        //   `+${this.getTime()}:${this.player}: ${this.message}`
        // );
        // this.message = "";
        // this.$refs.input.focus();
        // this.updateTimer();
      }
    },
    isCurrent(plyID) {
      return (
        this.game.position.plyID === plyID ||
        (plyID < 0 &&
          (!this.game.position.ply ||
            (!this.game.position.ply.index && !this.game.position.plyIsDone)))
      );
    },
    scroll: throttle(function () {
      const index = this.plyIDs.findIndex((id) => id === this.currentPlyID);
      if (index >= 0) {
        this.$refs.scroll.scrollTo(index, "center-force");
      }
    }, 100),
  },
  watch: {
    log() {
      this.$nextTick(() => this.scroll());
    },
    currentPlyID() {
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

<style lang="scss">
.chat {
  .notes {
    .scroll:before {
      content: "";
      display: block;
      height: 100%;
    }
  }
}
</style>
