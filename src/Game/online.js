import Comment from "./PTN/Comment";
import Evaluation from "./PTN/Evaluation";
import Linenum from "./PTN/Linenum";
import Move from "./PTN/Move";
import Nop from "./PTN/Nop";
import Ply from "./PTN/Ply";
import Result from "./PTN/Result";
import Tag from "./PTN/Tag";

import { each, map, pick, zipObject } from "lodash";

export const getPlayer = (game, uid) => {
  return game && game.config && game.config.players
    ? game.config.players.indexOf(uid) + 1
    : 0;
};

export default class GameOnline {
  getPlayerFromUID(uid) {
    return getPlayer(this, uid);
  }

  get openPlayer() {
    return this.config.players ? this.config.players.indexOf(null) + 1 : 1;
  }

  // Data
  get data() {
    return {
      name: this.name,
      tags: this.jsonTags,
      config: this.jsonConfig,
      state: this.jsonState,
      notes: this.jsonNotes,
    };
  }

  set data(json) {
    this.init(json);
  }

  // Uppercase versions for consistency with CREATE_GAME action
  get JSONState() {
    return this.jsonState;
  }

  get JSONTags() {
    return this.jsonTags;
  }

  // Config
  get jsonConfig() {
    const config = pick(this.config, [
      "size",
      "komi",
      "opening",
      "openingSwap",
      "pieceCounts",
      "isOnline",

      // Online only:
      "id",
      "isOpen",
      "isPrivate",
      "players",
      "player",
      "type",
      "scratchboard",
      "showRoads",
      "flatCounts",
      "stackCounts",
    ]);
    if (!this.config.hasCustomPieceCount) {
      config.pieceCounts = null;
    }
    return config;
  }

  // State
  get jsonState() {
    return {
      hasEnded: this.hasEnded,
      branch: this.board.branch,
      plyIndex: this.board.ply ? this.board.ply.index : 0,
      plyIsDone: this.board.plyIsDone,
      tps: this.board.tps,
      ply: this.board.ply ? this.board.ply.toString(true) : null,
      undoRequest: this.board.undoRequest,
    };
  }

  // Tags
  get jsonTags() {
    let tags = zipObject(
      Object.keys(this.tags),
      map(this.tags, (tag) => tag.output.text || tag.output)
    );
    if (tags.date) {
      tags.date = Tag.toDate(tags.date, tags.time);
    }
    delete tags.time;
    return tags;
  }

  set jsonTags(json) {
    json = { ...json };
    if (json.date) {
      const date = new Date(
        json.date.seconds ? json.date.seconds * 1e3 : json.date
      );
      json.time = Tag.timeFromDate(date);
      json.date = Tag.dateFromDate(date);
    }
    let tags = {};
    each(json, (value, key) => {
      const tag = new Tag(false, key, value);
      tags[tag.key.toLowerCase()] = tag;
    });
    this.tags = tags;
  }

  // Branches
  get jsonBranches() {
    return map(this.branches, (ply, name) => ({
      parent: ply.branches.parent ? ply.branches.parent.dataID : null,
      name,
      player: ply.player,
      plies: ply.branchPlies.map((ply) => ply.data),
      uid: ply.uid,
      createdAt: ply.createdAt,
      updatedAt: ply.updatedAt,
    }));
  }

  set jsonBranches(branches) {
    if (!branches || !Array.isArray(branches)) {
      return;
    }
    // Parse branches from Firestore format
    // Each branch has: { parent, name, player, plies, uid, createdAt, updatedAt }
    branches.forEach((branchData) => {
      if (!branchData.plies || !Array.isArray(branchData.plies)) {
        return;
      }
      // TODO: Reconstruct branch tree and plies
      // This requires parsing each ply and linking to parent branches
      // Will be completed when implementing full branch management
    });
  }

  get jsonBranch() {
    const name = this.board.branch;
    const ply = this.branches[name];
    return {
      parent: ply.branches.parent ? ply.branches.parent.dataID : null,
      name,
      player: ply.player,
      plies: ply.branchPlies.map((ply) => ply.data),
      uid: ply.uid,
      createdAt: ply.createdAt,
      updatedAt: ply.updatedAt,
    };
  }

  set jsonBranch(branch) {
    if (!branch || !branch.plies) {
      return;
    }
    // Parse single branch from Firestore format
    // TODO: Implement ply parsing and branch reconstruction
    // This will be completed when implementing full branch management
  }

  get jsonNotes() {
    return (this.notes[-1] || []).map((note) => note.contents);
  }

  set jsonNotes(notes) {
    this.addNotes({ "-1": notes });
  }

  // parseJSONPly(ply, player, color, branch) {
  //   if (!ply) {
  //     return null;
  //   } else if (ply.isNop) {
  //     return new Nop();
  //   } else if (Ply.test(ply.text)) {
  //     ply = Ply.parse(ply.text, {
  //       id: this.plies.length,
  //       player,
  //       color,
  //       evaluation: ply.evaluation
  //         ? Evaluation.parse(ply.evaluation)
  //         : undefined,
  //       result: ply.result ? Result.parse(ply.result) : undefined,
  //     });
  //     this.plies.push(ply);
  //     if (!(branch in this.branches)) {
  //       this.branches[branch] = ply;
  //     }
  //     return ply;
  //   } else {
  //     throw new Error("Invalid PTN format");
  //   }
  // }

  // Chat
  get jsonPlayerChat() {
    // Return player chat messages for current ply
    const plyID = (this.board && this.board.ply && this.board.ply.id) || -1;
    return (this.chatlog[plyID] || [])
      .filter((comment) => comment.player !== null)
      .map((comment) => ({
        text: comment.text,
        player: comment.player,
        uid: comment.uid,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
      }));
  }

  set jsonPlayerChat(messages) {
    if (!messages || !Array.isArray(messages)) {
      return;
    }
    // Parse player chat messages from Firestore
    // Messages have: { text, uid, createdAt, updatedAt }
    // TODO: Convert to Comment objects and add to chatlog
  }

  get jsonSpectatorChat() {
    // Return spectator chat messages (player === null)
    const plyID = (this.board && this.board.ply && this.board.ply.id) || -1;
    return (this.chatlog[plyID] || [])
      .filter((comment) => comment.player === null)
      .map((comment) => ({
        text: comment.text,
        uid: comment.uid,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
      }));
  }

  set jsonSpectatorChat(messages) {
    if (!messages || !Array.isArray(messages)) {
      return;
    }
    // Parse spectator chat messages from Firestore
    // Messages have: { text, uid, createdAt, updatedAt }
    // TODO: Convert to Comment objects and add to chatlog
  }

  // parseJSONComments(comments, plyID) {
  //   comments.forEach((comment) => {
  //     comment = Comment.parse(`{${comment}}`);
  //     const log = comment.player === null ? "notes" : "chatlog";
  //     if (!this[log][plyID]) {
  //       this[log][plyID] = [];
  //     }
  //     this[log][plyID].push(comment);
  //   });
  // }
}
