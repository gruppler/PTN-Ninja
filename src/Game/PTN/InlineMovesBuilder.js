export default class InlineMovesBuilder {
  constructor({ allMoves, allPlies, getBranchesToShow }) {
    this.allMoves = allMoves || [];
    this.allPlies = allPlies || [];
    this.getBranchesToShow = getBranchesToShow || (() => []);
  }

  build() {
    const result = [];
    const allMoves = this.allMoves;
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

      return this.getBranchesToShow(ply) || [];
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
  }
}
