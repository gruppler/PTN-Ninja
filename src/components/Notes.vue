<template>
  <div class="notes column no-wrap">
    <div class="col-grow relative-position">
      <div class="absolute-fit scroll">
        <div class="q-px-md">
          <template v-for="(plyID, i) in plyIDs">
            <q-separator
              v-if="i && !areSequential(plyIDs[i - 1], plyID)"
              class="fullwidth-padded-md"
              :key="'divider-' + plyID"
              dark
            />
            <div
              class="fullwidth-padded-md q-py-xs"
              :class="{ highlight: isCurrent(plyID), 'q-pt-md': plyID < 0 }"
              :key="plyID"
              :ref="plyID"
            >
              <div v-if="plyID >= 0 && game.plies[plyID]" class="ply-container">
                <Move
                  :game="game"
                  :move="game.plies[plyID].move"
                  :player="game.plies[plyID].player"
                  no-decoration
                />
              </div>
              <q-chat-message
                v-for="(comment, index) in log[plyID]"
                :key="`message-${plyID}-${index}`"
                :id="`message-${plyID}-${index}`"
                bg-color="accent"
                text-color="grey-10"
                text-sanitize
                sent
              >
                <span>{{ comment.message }}</span>
                <q-menu
                  context-menu
                  auto-close
                  :target="`#message-${plyID}-${index} > div > div`"
                >
                  <q-list dark class="bg-secondary text-white">
                    <q-item @click="edit(plyID, index)" clickable>
                      <q-item-section side>
                        <q-icon name="edit" />
                      </q-item-section>
                      <q-item-section>{{ $t("Edit") }}</q-item-section>
                    </q-item>
                    <q-item @click="remove(plyID, index)" clickable>
                      <q-item-section side>
                        <q-icon name="delete" />
                      </q-item-section>
                      <q-item-section>{{ $t("Delete") }}</q-item-section>
                    </q-item>
                  </q-list>
                </q-menu>
              </q-chat-message>
            </div>
          </template>
        </div>
      </div>
      <div class="absolute-fit inset-shadow no-pointer-events" />
      <q-resize-observer @resize="scroll" />
    </div>
    <div>
      <q-input
        ref="input"
        @keydown.shift.enter.prevent="send"
        @keydown.esc="cancelEdit"
        @blur="cancelEdit"
        debounce="50"
        class="footer-toolbar bg-secondary text-accent col-grow q-pa-sm items-end"
        v-model="message"
        :placeholder="$t('Note')"
        dense
        rounded
        autogrow
        outlined
        color="accent"
        bg-color="accent"
      >
        <template v-slot:append>
          <q-btn
            @click="send"
            :icon="editing ? 'edit' : 'add_comment'"
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
import Move from "./Move";

import { pickBy } from "lodash";

export default {
  name: "Notes",
  components: { Move },
  props: ["game"],
  data() {
    return {
      message: "",
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
              id < 0 || this.game.state.plies.includes(this.game.plies[id])
          );
    },
    plyIDs() {
      return Object.keys(this.log)
        .map(id => 1 * id)
        .sort((a, b) => a - b);
    },
    currentPlyID() {
      if (!this.log) {
        return null;
      }
      if (this.editing) {
        return this.editing.plyID;
      }
      let plyID, ply;
      if (!this.game.state.plyID && !this.game.state.plyIsDone) {
        return this.plyIDs[0];
      } else if (this.game.state.ply) {
        if (this.game.state.plyID in this.log) {
          return this.game.state.plyID;
        } else if (this.isCurrent(-1)) {
          return -1;
        } else {
          for (let i = this.plyIDs.length - 1; i >= 0; i--) {
            plyID = this.plyIDs[i];
            ply = plyID in this.game.plies ? this.game.plies[plyID] : null;
            if (
              ply &&
              (this.game.state.plies.includes(ply) &&
                ply.index < this.game.state.ply.index)
            ) {
              return plyID;
            }
          }
          return this.plyIDs[0];
        }
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
    edit(plyID, index) {
      const log = this.log[plyID][index];
      this.editing = { plyID, index };
      setTimeout(() => {
        this.$refs.input.focus();
        this.message = log.message;
      }, 100);
    },
    cancelEdit() {
      if (this.editing) {
        this.editing = null;
        this.message = "";
      }
    },
    remove(plyID, index) {
      this.game.removeNote(plyID, index);
    },
    isCurrent(plyID) {
      return (
        this.game.state.plyID === plyID ||
        (plyID < 0 &&
          (!this.game.state.ply ||
            (!this.game.state.ply.index && !this.game.state.plyIsDone)))
      );
    },
    areSequential(plyID1, plyID2) {
      const ply1 = plyID1 < 0 ? null : this.game.plies[plyID1];
      const ply2 = this.game.plies[plyID2];
      return (
        ply1 &&
        ply2 &&
        ply1.branch === ply2.branch &&
        ply2.move.number - ply1.move.number <= 1
      );
    },
    scroll() {
      let message = this.$refs[this.currentPlyID];
      if (message) {
        message = message[0];
      }
      if (message) {
        message.scrollIntoView({
          block: "end"
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
    this.$nextTick(this.scroll);
  }
};
</script>

<style lang="stylus">
.notes
  .q-separator
    opacity .75
  .q-message:not(:last-child)
    margin-bottom 3px
    .q-message-text
      border-radius $generic-border-radius
      min-height 2em
      &:before
        display none
  .ply-container
    padding-bottom .5em
</style>
