import Comment from "../Comment";
import Evaluation from "../Evaluation";
import Linenum from "../Linenum";
import Move from "../Move";
import Nop from "../Nop";
import Ply from "../Ply";
import Result from "../Result";
import Tag from "../Tag";

import { each, map, zipObject } from "lodash";

export default class GameOnline {
  get openPlayer() {
    return this.tag("player1") ? (this.tag("player2") ? 0 : 2) : 1;
  }

  get json() {
    return {
      name: this.name,
      state: this.minState,
      options: Object.assign({}, this.options),
      tags: this.JSONTags,
      comments: this.JSONComments(
        (this.notes[-1] || []).concat(this.chatlog[-1] || [])
      ),
      moves: this.JSONMoves
    };
  }

  set json(json) {
    this.init(false, json);
  }

  get JSONTags() {
    return zipObject(Object.keys(this.tags), map(this.tags, "valueText"));
  }

  parseJSONTags(json) {
    each(json, (value, key) => {
      const tag = new Tag(false, key, value);
      this.tags[tag.key.toLowerCase()] = tag;
    });
  }

  get JSONMoves() {
    return this.moves.map(move => {
      const comments = this.getMoveComments(move);
      return {
        branch: move.branch,
        number: move.number,
        ply1: this.JSONPly(move.ply1),
        ply2: this.JSONPly(move.ply2),
        comments1: this.JSONComments(comments[0]),
        comments2: this.JSONComments(comments[1])
      };
    });
  }

  parseJSONMoves(json) {
    json.forEach(moveParams => {
      const move = new Move({
        game: this,
        id: this.moves.length,
        linenum: Linenum.parse(
          moveParams.number + ".",
          this,
          moveParams.branch
        ),
        ply1: this.parseJSONPly(
          moveParams.ply1,
          1,
          moveParams.number === 1 && !this.hasTPS ? 2 : 1,
          moveParams.branch
        ),
        ply2: this.parseJSONPly(
          moveParams.ply2,
          2,
          moveParams.number === 1 && !this.hasTPS ? 1 : 2,
          moveParams.branch
        )
      });

      if (moveParams.comments1.length && move.ply1) {
        this.parseJSONComments(moveParams.comments1, move.ply1.id);
      }
      if (moveParams.comments2.length && move.ply2) {
        this.parseJSONComments(moveParams.comments2, move.ply2.id);
      }

      this.moves.push(move);
    });
  }

  JSONPly(ply) {
    if (!ply) {
      return null;
    } else if (ply.isNop) {
      return {
        isNop: true
      };
    } else {
      let json = {
        text: ply.text(true)
      };
      if (ply.evaluation) {
        json.evaluation = ply.evaluation.text;
      }
      if (ply.result) {
        json.result = ply.result.text;
      }
      return json;
    }
  }

  parseJSONPly(ply, player, color, branch) {
    if (!ply) {
      return null;
    } else if (ply.isNop) {
      return new Nop();
    } else if (Ply.test(ply.text)) {
      ply = Ply.parse(ply.text, {
        id: this.plies.length,
        player,
        color,
        evaluation: ply.evaluation
          ? Evaluation.parse(ply.evaluation)
          : undefined,
        result: ply.result ? Result.parse(ply.result) : undefined
      });
      this.plies.push(ply);
      if (!(branch in this.branches)) {
        this.branches[branch] = ply;
      }
      return ply;
    } else {
      throw new Error("Invalid PTN format");
    }
  }

  JSONComments(comments) {
    return comments ? comments.map(comment => comment.contents) : [];
  }

  parseJSONComments(comments, plyID) {
    comments.forEach(comment => {
      comment = Comment.parse(`{${comment}}`);
      const log = comment.player === null ? "notes" : "chatlog";
      if (!this[log][plyID]) {
        this[log][plyID] = [];
      }
      this[log][plyID].push(comment);
    });
  }
}
