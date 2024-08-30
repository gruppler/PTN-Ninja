import Comment from "./PTN/Comment";
import Evaluation from "./PTN/Evaluation";
import Linenum from "./PTN/Linenum";
import Move from "./PTN/Move";
import Nop from "./PTN/Nop";
import Ply from "./PTN/Ply";
import Result from "./PTN/Result";
import Tag from "./PTN/Tag";

import { each, map, zipObject } from "lodash";

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
      tags: this.JSONTags,
      config: this.JSONConfig,
      state: this.JSONState,
      comments: this.JSONComments(
        (this.notes[-1] || []).concat(this.chatlog[-1] || [])
      ),
      moves: this.JSONMoves,
    };
  }

  set data(json) {
    this.init(json);
  }

  // Config
  get jsonConfig() {
    const config = Object.assign({}, this.config);
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
    // TODO:
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
    // TODO:
  }

  set jsonPlayerChat(comments) {
    // TODO:
  }

  get jsonSpectatorChat() {
    // TODO:
  }

  set jsonSpectatorChat(comments) {
    // TODO:
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
