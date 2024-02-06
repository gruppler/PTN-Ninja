<template>
  <div class="notes column no-wrap">
    <component
      :is="recess ? 'recess' : 'div'"
      class="col-grow relative-position"
    >
      <q-scroll-area id="notes-scroll-area" class="absolute-fit">
        <q-virtual-scroll
          ref="scroll"
          class="bg-transparent"
          :items="plyIDs"
          scroll-target="#notes-scroll-area > .scroll"
          :virtual-scroll-item-size="128"
          :virtual-scroll-slice-ratio-before="0.5"
          :virtual-scroll-slice-ratio-after="0.5"
        >
          <template v-slot="{ item }">
            <NoteItem
              :class="{
                'q-pt-md': item < 0,
              }"
              :key="item"
              :ref="item"
              :plyID="item"
              :notes="log[item]"
              @edit="edit"
              @remove="remove"
            />
          </template>
        </q-virtual-scroll>
      </q-scroll-area>
      <q-resize-observer @resize="scroll" />
    </component>
    <div>
      <q-input
        ref="input"
        @keydown.shift.enter.prevent="send"
        @keydown.esc="cancelEdit"
        @blur="cancelEdit"
        debounce="50"
        class="footer-toolbar bg-ui text-primary col-grow q-pa-sm items-end"
        v-model="message"
        :placeholder="$t('Note')"
        dense
        rounded
        autogrow
        outlined
        color="primary"
        bg-color="primary"
        :dark="primaryDark"
      >
        <template v-slot:append>
          <q-btn
            @click="send"
            :icon="editing ? 'edit' : 'add_note'"
            :disabled="!message.trim().length"
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
import NoteItem from "./NoteItem";

import { pickBy } from "lodash";

export default {
  name: "Notes",
  components: { NoteItem },
  props: {
    recess: Boolean,
  },
  data() {
    return {
      message: "",
      editing: null,
    };
  },
  computed: {
    game() {
      return this.$store.state.game;
    },
    plies() {
      return this.game.ptn.allPlies;
    },
    branchPlies() {
      return this.game.ptn.branchPlies;
    },
    primaryDark() {
      return this.$store.state.ui.theme.primaryDark;
    },
    log() {
      return this.$store.state.ui.showAllBranches
        ? this.game.comments.notes
        : Object.freeze(
            pickBy(
              this.game.comments.notes,
              (notes, id) => id < 0 || this.branchPlies.includes(this.plies[id])
            )
          );
    },
    plyIDs() {
      return Object.freeze(
        Object.keys(this.log)
          .map((id) => 1 * id)
          .sort((a, b) => a - b)
      );
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
    send() {
      if (this.message) {
        if (this.editing) {
          this.$store.dispatch("game/EDIT_NOTE", {
            plyID: this.editing.plyID,
            index: this.editing.index,
            message: this.message.trim(),
          });
          this.editing = null;
        } else {
          this.$store.dispatch("game/ADD_NOTE", {
            message: this.message.trim(),
          });
        }
        this.message = "";
        this.$refs.input.focus();
      }
    },
    edit({ plyID, index }) {
      const log = this.log[plyID][index];
      this.editing = { plyID, index };
      if (!this.isCurrent(plyID)) {
        this.$store.dispatch("game/GO_TO_PLY", { plyID, isDone: true });
      }
      setTimeout(() => {
        this.$refs.input.focus();
        this.message = log.message;
      }, 10);
    },
    cancelEdit() {
      if (this.editing) {
        this.editing = null;
        this.message = "";
      } else {
        this.$refs.input.blur();
      }
    },
    remove({ plyID, index }) {
      this.$store.dispatch("game/REMOVE_NOTE", { plyID, index });
    },
    isCurrent(plyID) {
      return (
        this.game.position.plyID === plyID ||
        (plyID < 0 &&
          (!this.game.position.ply ||
            (!this.game.position.ply.index && !this.game.position.plyIsDone)))
      );
    },
    async scroll() {
      const index = this.plyIDs.findIndex((id) => id === this.currentPlyID);
      if (index >= 0) {
        await this.$nextTick();
        this.$refs.scroll.refresh(index, "center-force");
      }
    },
  },
  updated() {
    this.scroll();
  },
};
</script>

<style lang="scss">
.notes {
  .q-separator {
    opacity: 0.75;
  }
}
</style>
