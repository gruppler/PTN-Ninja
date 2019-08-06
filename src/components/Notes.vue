<template>
  <div class="notes column no-wrap">
    <div class="col-grow relative-position">
      <q-scroll-area class="absolute-fit">
        <div class="q-pa-md">
          <div
            v-if="log[-1]"
            class="fullwidth-padded-md q-py-xs q-mb-md"
            :class="{ highlight: !game.state.plyID && !game.state.plyIsDone }"
            ref="-1"
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
              class="fullwidth-padded-md q-py-xs q-pr-sm q-mb-md"
              :class="{ highlight: game.state.plyID == plyID }"
              :key="plyID"
              :ref="plyID"
            >
              <div>
                <Linenum
                  v-if="game.plies[plyID].move.linenum"
                  :linenum="game.plies[plyID].move.linenum"
                  :game="game"
                />
                <Ply
                  :ply="game.plies[plyID]"
                  :game="game"
                  :delay="6e4 / $store.state.playSpeed"
                />
              </div>
              <q-chat-message
                :data-ply="plyID"
                :key="plyID + '-messages'"
                :text="comments.map(comment => comment.message)"
                bg-color="accent"
                text-color="grey-10"
                text-sanitize
              />
            </div>
          </template>
          <q-menu
            ref="menu"
            context-menu
            auto-close
            @show="menu"
            @hide="selected = null"
          >
            <q-list dark class="bg-secondary text-white">
              <q-item @click="edit" clickable>
                <q-item-section side>
                  <q-icon name="edit" />
                </q-item-section>
                <q-item-section>{{ $t("Edit") }}</q-item-section>
              </q-item>
              <q-item @click="remove" clickable>
                <q-item-section side>
                  <q-icon name="delete" />
                </q-item-section>
                <q-item-section>{{ $t("Delete") }}</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </div>
      </q-scroll-area>
    </div>
    <div>
      <q-separator />
      <q-input
        ref="input"
        @keydown.shift.enter.prevent="send"
        @keydown.esc="
          editing = null;
          message = '';
        "
        debounce="50"
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
            :icon="!editing ? 'add' : 'edit'"
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

import { pickBy } from "lodash";

export default {
  name: "Notes",
  components: { Ply, Linenum },
  props: ["game"],
  data() {
    return {
      message: "",
      timer: null,
      selected: null,
      editing: null
    };
  },
  computed: {
    log() {
      return this.$store.state.showAllBranches
        ? this.game.notes
        : pickBy(
            this.game.notes,
            (notes, id) =>
              id < 0 ||
              this.game.plies[id].isInBranch(this.game.state.targetBranch)
          );
    },
    currentPlyID() {
      if (!this.log) {
        return null;
      }
      const ids = Object.keys(this.log)
        .map(id => 1 * id)
        .sort((a, b) => a - b);
      if (!this.game.state.plyID && !this.game.state.plyIsDone) {
        return ids[0];
      } else if (this.game.state.ply) {
        for (let i = 0; i < ids.length; i++) {
          if (ids[i] === this.game.state.plyID) {
            return this.game.state.plyID;
          } else if (
            ids[i] in this.game.plies &&
            this.game.plies[ids[i]].index > this.game.state.ply.index
          ) {
            return ids[i - !!i];
          }
        }
        return ids[ids.length - 1];
      }
      return null;
    }
  },
  methods: {
    send() {
      if (this.message.trim()) {
        this.message = this.message.trim();
        if (this.editing) {
          this.game.editNote(
            this.editing.plyID,
            this.editing.index,
            this.message
          );
          this.editing = null;
        } else {
          this.game.addNote(this.message);
        }
        this.message = "";
        this.$refs.input.focus();
      }
    },
    menu(event) {
      const message = event.target.closest(".q-message-text");
      if (message) {
        this.selected = {
          plyID: 1 * message.closest(".q-message").dataset.ply,
          index: Array.prototype.indexOf.call(
            message.parentElement.children,
            message
          )
        };
      } else {
        event.stopPropagation();
      }
    },
    edit() {
      if (this.selected) {
        const log = this.log[this.selected.plyID][this.selected.index];
        this.editing = Object.assign({}, this.selected);
        this.message = log.message;
        this.$refs.input.focus();
      }
    },
    remove() {
      if (this.selected) {
        this.game.removeNote(this.selected.plyID, this.selected.index);
      }
    },
    scroll() {
      let message = this.$refs[this.currentPlyID];
      if (message && this.currentPlyID >= 0) {
        message = message[0];
      }
      if (message) {
        message.scrollIntoView({
          block: "start"
        });
      }
    }
  },
  watch: {
    log() {
      this.$nextTick(this.scroll);
    },
    currentPlyID() {
      this.scroll();
    }
  },
  mounted() {
    this.scroll();
  }
};
</script>

<style lang="stylus"></style>
