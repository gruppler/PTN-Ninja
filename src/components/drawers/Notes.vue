<template>
  <div class="notes column no-wrap">
    <component
      :is="recess ? 'recess' : 'div'"
      class="col-grow relative-position"
    >
      <q-scroll-area ref="scroll" class="absolute-fit">
        <div class="content q-px-md">
          <template v-for="(plyID, i) in plyIDs">
            <q-separator
              v-if="i && !areSequential(plyIDs[i - 1], plyID)"
              class="fullwidth-padded-md"
              :key="'divider-' + plyID"
            />
            <div
              class="fullwidth-padded-md q-py-xs"
              :class="{ current: isCurrent(plyID), 'q-pt-md': plyID < 0 }"
              :key="plyID"
              :ref="plyID"
            >
              <div v-if="plyID >= 0 && plies[plyID]" class="ply-container">
                <Move
                  :move="getMove(plyID)"
                  :player="getPlayer(plyID)"
                  separate-branch
                  no-decoration
                />
              </div>
              <q-chat-message
                v-for="(comment, index) in log[plyID]"
                :key="`message-${plyID}-${index}`"
                :id="`message-${plyID}-${index}`"
                bg-color="primary"
                :text-color="primaryDark ? 'textLight' : 'textDark'"
                text-sanitize
                sent
              >
                <span>{{ comment.message }}</span>
                <template v-slot:stamp>
                  <q-menu
                    context-menu
                    auto-close
                    transition-show="none"
                    transition-hide="none"
                    :target="`#message-${plyID}-${index} > div > div`"
                  >
                    <q-list>
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
                </template>
              </q-chat-message>
            </div>
          </template>
        </div>
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
        v-model.trim="message"
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
import Move from "../PTN/Move";

import { pickBy } from "lodash";

export default {
  name: "Notes",
  components: { Move },
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
    isShowing() {
      return (
        (this.$store.state.ui.showText && !this.hasChat) ||
        this.$store.state.ui.textTab === "notes"
      );
    },
    primaryDark() {
      return this.$store.state.ui.theme.primaryDark;
    },
    log() {
      return this.$store.state.ui.showAllBranches
        ? this.game.comments.notes
        : pickBy(
            this.game.comments.notes,
            (notes, id) => id < 0 || this.branchPlies.includes(this.plies[id])
          );
    },
    plyIDs() {
      return Object.keys(this.log)
        .map((id) => 1 * id)
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
    getMove(plyID) {
      const ply = this.game.ptn.allPlies[plyID];
      if (ply) {
        return this.game.ptn.allMoves[ply.move];
      } else {
        throw "Invalid plyID";
      }
    },
    getPlayer(plyID) {
      const ply = this.game.ptn.allPlies[plyID];
      if (ply) {
        return ply.player;
      } else {
        throw "Invalid plyID";
      }
    },
    send() {
      if (this.message) {
        if (this.editing) {
          this.$store.dispatch("game/EDIT_NOTE", {
            plyID: this.editing.plyID,
            index: this.editing.index,
            message: this.message,
          });
          this.editing = null;
        } else {
          this.$store.dispatch("game/ADD_NOTE", this.message);
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
      } else {
        this.$refs.input.blur();
      }
    },
    remove(plyID, index) {
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
    areSequential(plyID1, plyID2) {
      const ply1 = plyID1 < 0 ? null : this.plies[plyID1];
      const ply2 = this.plies[plyID2];
      return (
        ply1 &&
        ply2 &&
        ply1.branch === ply2.branch &&
        ply2.linenum.number - ply1.linenum.number <= 1
      );
    },
    scroll(animate = false) {
      let message = this.$refs[this.currentPlyID];
      if (message) {
        message = message[0];
      }
      if (message) {
        this.$refs.scroll.setScrollPosition(
          message.offsetTop -
            this.$refs.scroll.$el.offsetHeight +
            message.offsetHeight,
          animate && this.isShowing ? 300 : 0
        );
      }
    },
  },
  watch: {
    log() {
      this.$nextTick(() => this.scroll(true));
    },
    currentPlyID() {
      this.scroll(true);
    },
  },
  mounted() {
    this.$nextTick(() => this.scroll());
  },
};
</script>

<style lang="scss">
.notes {
  .content {
    padding-top: calc(100vh - #{$toolbar-min-height + $footer-toolbar-height});
  }
  .q-separator {
    opacity: 0.75;
  }
  .current {
    background-color: $dim;
    body.panelDark & {
      background-color: $highlight;
    }
  }
  .q-message:not(:last-child) {
    margin-bottom: 3px;
    .q-message-text {
      border-radius: $generic-border-radius;
      min-height: 2em;
      &:before {
        display: none;
      }
    }
  }
  .ply-container {
    padding-bottom: 0.5em;
  }
}
</style>
