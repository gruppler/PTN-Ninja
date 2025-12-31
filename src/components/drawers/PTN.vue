<template>
  <component :is="recess ? 'recess' : 'div'" class="col-grow relative-position">
    <q-scroll-area
      id="ptn-scroll-area"
      class="full-ptn absolute-fit non-selectable"
    >
      <q-virtual-scroll
        v-if="gameExists"
        ref="scroll"
        class="bg-transparent"
        :items="moves"
        scroll-target="#ptn-scroll-area > .scroll"
        :virtual-scroll-item-size="35.64"
        :virtual-scroll-slice-ratio-before="0.5"
        :virtual-scroll-slice-ratio-after="0.5"
      >
        <template v-slot="{ item }">
          <q-separator
            v-if="item && item.type === 'branch-separator'"
            class="fullwidth-padded-md"
          />
          <Move
            v-else
            :ref="item.id"
            :key="item.id"
            :move="item.move || item"
            :depth="item.depth"
            :split-ply="item.splitPly"
            :inline-branches="inlineBranches"
            fixed-linenumber-width
            separate-branch
            no-menu-btn
            show-eval
          >
            <template v-slot:plyTooltip="ply">
              <PlyPreview
                :tps="ply.tpsAfter"
                :hl="ply.text"
                :options="$store.state.game.config"
              />
            </template>
          </Move>
        </template>
      </q-virtual-scroll>
    </q-scroll-area>
    <q-resize-observer @resize="scroll" />
  </component>
</template>

<script>
import Move from "../PTN/Move";
import PlyPreview from "../controls/PlyPreview";

import { throttle } from "lodash";

export default {
  name: "PTN",
  components: { Move, PlyPreview },
  props: {
    recess: Boolean,
  },
  data() {
    return {
      branchOverrides: {},
      seenTargetBranches: [],
    };
  },
  created() {
    const targetBranch = this.position && this.position.targetBranch;
    if (targetBranch) {
      this.seenTargetBranches = [targetBranch];
    }
  },
  provide() {
    return {
      branchUI: {
        isExpanded: (ply) => this.isBranchExpanded(ply),
        toggle: (ply) => this.toggleBranchExpanded(ply),
      },
    };
  },
  computed: {
    gameExists() {
      return Boolean(this.ptn);
    },
    position() {
      return this.$store.state.game.position;
    },
    ptn() {
      return this.$store.state.game.ptn;
    },
    inlineBranches() {
      return (
        this.$store.state.ui.inlineBranches &&
        this.$store.state.ui.showAllBranches
      );
    },
    moves() {
      if (this.$store.state.ui.showAllBranches) {
        if (this.$store.state.ui.inlineBranches) {
          return Object.freeze(this.buildInlineMoves());
        }
        return Object.freeze(this.ptn.sortedMoves);
      }
      return Object.freeze(this.ptn.branchMoves);
    },
  },
  methods: {
    isBranchPrefixOfTarget(branch, targetBranch) {
      if (!branch || !targetBranch) {
        return false;
      }
      return targetBranch === branch || targetBranch.startsWith(branch + "/");
    },
    isBranchPrefixOfAnyTarget(branch, targetBranches) {
      if (!branch || !targetBranches || !targetBranches.length) {
        return false;
      }
      return targetBranches.some((targetBranch) =>
        this.isBranchPrefixOfTarget(branch, targetBranch)
      );
    },
    getDefaultExpandedBranches(ply) {
      const targetBranch = this.position.targetBranch || "";
      const targets = this.seenTargetBranches.length
        ? this.seenTargetBranches
        : targetBranch
        ? [targetBranch]
        : [];

      if (
        !targets.length ||
        !ply ||
        !ply.branches ||
        ply.branches.length <= 1
      ) {
        return [];
      }

      const branches = ply.branches
        .slice(1)
        .map((id) => this.ptn.allPlies[id])
        .filter(Boolean);

      return branches.filter((branchPly) =>
        this.isBranchPrefixOfAnyTarget(branchPly.branch, targets)
      );
    },
    getBranchesToShow(ply) {
      const override = this.branchOverrides[ply.id];
      if (override === false) {
        return [];
      }

      const branches = ply.branches
        .slice(1)
        .map((id) => this.ptn.allPlies[id])
        .filter(Boolean);

      if (override === true) {
        return branches;
      }

      return this.getDefaultExpandedBranches(ply);
    },
    isBranchExpanded(ply) {
      if (!ply || !ply.branches || ply.branches.length <= 1) {
        return false;
      }

      const override = this.branchOverrides[ply.id];
      if (override === true) {
        return true;
      }
      if (override === false) {
        return false;
      }

      return this.getDefaultExpandedBranches(ply).length > 0;
    },
    toggleBranchExpanded(ply) {
      if (!ply || !ply.id) {
        return;
      }

      const defaultExpanded = this.getDefaultExpandedBranches(ply).length > 0;
      const override = this.branchOverrides[ply.id];
      const effectiveExpanded =
        override === undefined ? defaultExpanded : Boolean(override);

      const nextExpanded = !effectiveExpanded;

      if (!nextExpanded) {
        const targetBranch = this.position && this.position.targetBranch;
        const branchPlies = ply.branches
          .slice(1)
          .map((id) => this.ptn.allPlies[id])
          .filter(Boolean);

        if (
          targetBranch &&
          branchPlies.some((branchPly) =>
            this.isBranchPrefixOfTarget(branchPly.branch, targetBranch)
          )
        ) {
          this.$store.dispatch("game/SET_TARGET", ply);
        }
      }

      if (nextExpanded === defaultExpanded) {
        const { [ply.id]: _removed, ...rest } = this.branchOverrides;
        this.branchOverrides = rest;
      } else {
        this.branchOverrides = {
          ...this.branchOverrides,
          [ply.id]: nextExpanded,
        };
      }
    },
    buildInlineMoves() {
      const result = [];
      const allMoves = this.ptn.allMoves;
      const visitedBranches = new Set();
      let separatorCounter = 0;

      const safeBranchId = (branchName) =>
        String(branchName || "root").replaceAll("/", "_");

      const makeBranchSeparator = (branchName, depth, position) => {
        separatorCounter += 1;
        return {
          type: "branch-separator",
          position,
          branch: branchName,
          depth,
          id: `branch-separator-${position}-${safeBranchId(
            branchName
          )}-${depth}-${separatorCounter}`,
        };
      };

      const makeId = (move, depth, splitPly) => {
        const depthSuffix = depth ? "-d" + depth : "";
        const splitSuffix = splitPly ? "-" + splitPly : "";
        return move.id + depthSuffix + splitSuffix;
      };

      const makeItem = (move, depth, splitPly) => {
        const item = {
          ...move,
          move,
          depth,
          id: makeId(move, depth, splitPly),
        };
        if (splitPly) {
          item.splitPly = splitPly;
        }
        return item;
      };

      const getBranchesForPly = (ply) => {
        if (!ply || !ply.branches || ply.branches.length <= 1) {
          return [];
        }

        // In the UI PTN output, ply.branches is an array of ply IDs.
        // Branch child plies share the same branches array, so only the branch parent
        // (branches[0]) should be treated as the branch point.
        if (ply.branches[0] !== ply.id) {
          return [];
        }

        return this.getBranchesToShow(ply);
      };

      const shouldSplitMove = (move) => {
        if (!move || !move.ply1 || !move.ply2 || move.ply2.isNop) {
          return false;
        }

        return getBranchesForPly(move.ply1).length > 0;
      };

      const getMovesForBranch = (branchName) =>
        allMoves
          .filter((m) => m && m.branch === branchName)
          .sort((a, b) => a.index - b.index || a.id - b.id);

      const rootMoves = getMovesForBranch("");

      const addBranchMoves = (branchName, depth) => {
        if (visitedBranches.has(branchName)) {
          return;
        }
        visitedBranches.add(branchName);

        const moves = getMovesForBranch(branchName);
        if (moves.length) {
          result.push(makeBranchSeparator(branchName, depth, "start"));
        }
        moves.forEach((move) => {
          if (shouldSplitMove(move)) {
            result.push(makeItem(move, depth, "split1"));

            const branchesToShow = getBranchesForPly(move.ply1);
            branchesToShow.forEach((branchPly) => {
              if (branchPly && branchPly.branch) {
                addBranchMoves(branchPly.branch, depth + 1);
              }
            });

            result.push(makeItem(move, depth, "split2"));

            const branchesToShow2 = getBranchesForPly(move.ply2);
            branchesToShow2.forEach((branchPly) => {
              if (branchPly && branchPly.branch) {
                addBranchMoves(branchPly.branch, depth + 1);
              }
            });
          } else {
            result.push({ ...move, move, depth, id: makeId(move, depth) });

            const ply1 = move.ply1;
            const ply2 = move.ply2;
            [ply1, ply2].forEach((ply) => {
              const branchesToShow = getBranchesForPly(ply);
              branchesToShow.forEach((branchPly) => {
                if (branchPly && branchPly.branch) {
                  addBranchMoves(branchPly.branch, depth + 1);
                }
              });
            });
          }
        });

        if (moves.length) {
          result.push(makeBranchSeparator(branchName, depth, "end"));
        }
      };

      rootMoves.forEach((move) => {
        if (shouldSplitMove(move)) {
          result.push(makeItem(move, 0, "split1"));

          const branchesToShow = getBranchesForPly(move.ply1);
          branchesToShow.forEach((branchPly) => {
            if (branchPly && branchPly.branch) {
              addBranchMoves(branchPly.branch, 1);
            }
          });

          result.push(makeItem(move, 0, "split2"));

          const branchesToShow2 = getBranchesForPly(move.ply2);
          branchesToShow2.forEach((branchPly) => {
            if (branchPly && branchPly.branch) {
              addBranchMoves(branchPly.branch, 1);
            }
          });
        } else {
          result.push(move);
          const ply1 = move.ply1;
          const ply2 = move.ply2;
          [ply1, ply2].forEach((ply) => {
            const branchesToShow = getBranchesForPly(ply);
            branchesToShow.forEach((branchPly) => {
              if (branchPly && branchPly.branch) {
                addBranchMoves(branchPly.branch, 1);
              }
            });
          });
        }
      });

      const compacted = [];
      result.forEach((item) => {
        if (item && item.type === "branch-separator") {
          const prev = compacted[compacted.length - 1];
          if (prev && prev.type === "branch-separator") {
            return;
          }
        }
        compacted.push(item);
      });

      return compacted;
    },
    scroll: throttle(function () {
      const editingBranch = this.$store.state.ui.editingBranch
        ? this.ptn.branches[this.$store.state.ui.editingBranch] || null
        : null;

      const move = editingBranch ? editingBranch.move : this.position.move;
      if (!move) {
        return;
      }

      const index = this.moves.findIndex(
        (item) => (item.move || item).id === move.id
      );

      if (index >= 0) {
        this.$refs.scroll.scrollTo(index, "center-force");
      }
    }, 100),
  },
  watch: {
    "position.tps"() {
      this.$nextTick(() => this.scroll());
    },
    "position.targetBranch"() {
      const targetBranch = this.position.targetBranch;
      if (targetBranch && !this.seenTargetBranches.includes(targetBranch)) {
        this.seenTargetBranches = [...this.seenTargetBranches, targetBranch];
      }

      if (
        targetBranch &&
        this.$store.state.ui.inlineBranches &&
        this.$store.state.ui.showAllBranches &&
        this.ptn &&
        this.ptn.branches &&
        this.ptn.allPlies
      ) {
        const segments = String(targetBranch).split("/").filter(Boolean);
        const overrides = { ...this.branchOverrides };
        let prefix = "";
        segments.forEach((seg) => {
          prefix = prefix ? `${prefix}/${seg}` : seg;
          const branchPly = this.ptn.branches[prefix];
          if (
            branchPly &&
            branchPly.branches &&
            branchPly.branches.length > 1
          ) {
            const branchPointId = branchPly.branches[0];
            if (branchPointId != null) {
              overrides[branchPointId] = true;
            }
          }
        });
        this.branchOverrides = overrides;
      }

      this.$nextTick(() => this.scroll());
    },
    "$store.state.ui.showAllBranches"() {
      this.$nextTick(() => this.scroll());
    },
  },
};
</script>

<style lang="scss">
.full-ptn {
  .ptn.ply.other {
    opacity: 0.5;
  }
}
</style>
