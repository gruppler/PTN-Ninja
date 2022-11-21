import Comment from "./PTN/Comment";
import Evaluation from "./PTN/Evaluation";

import { omit } from "lodash";

export default class GameComments {
  getMoveComments(move) {
    let comments = [];
    if (move.ply1 && "id" in move.ply1) {
      comments[0] = (this.notes[move.ply1.id] || []).concat(
        this.chatlog[move.ply1.id] || []
      );
    }
    if (move.ply2 && "id" in move.ply2) {
      comments[1] = (this.notes[move.ply2.id] || []).concat(
        this.chatlog[move.ply2.id] || []
      );
    }
    return comments;
  }

  addComment(type, message) {
    message = Comment.parse("{" + message + "}");
    const plyID =
      this.board.plyIndex <= 0 && !this.board.plyIsDone ? -1 : this.board.plyID;
    if (!this[type][plyID]) {
      // First comment
      this[type] = Object.assign({ [plyID]: [message] }, this[type]);
    } else {
      // Another comment
      this[type][plyID].push(message);
    }
    this._updatePTN(true);
    this.board.dirtyComment(type, plyID);
    this.board.updateCommentsOutput();
    return message;
  }

  editComment(type, plyID, index, message) {
    if (this[type][plyID] && this[type][plyID][index]) {
      this[type][plyID][index].message = message;
      this._updatePTN(true);
      this.board.dirtyComment(type, plyID);
      this.board.updateCommentsOutput();
      return this[type][plyID][index];
    }
    return null;
  }

  removeComment(type, plyID, index) {
    if (this[type][plyID]) {
      if (this[type][plyID].length > 1) {
        this[type][plyID].splice(index, 1);
      } else {
        this[type] = omit(this[type], plyID);
      }
      this._updatePTN(true);
      this.board.dirtyComment(type, plyID);
      this.board.updateCommentsOutput();
    }
  }

  removePlyComments(plyID) {
    if (this.notes[plyID]) {
      this.notes = omit(this.notes, plyID);
      this.board.dirtyComment("notes", plyID);
      this.board.updateCommentsOutput();
    }
  }

  addChatMessage(message) {
    return this.addComment("chatlog", message);
  }

  editChatMessage(plyID, index, message) {
    return this.editComment("chatlog", plyID, index, message);
  }

  removeChatMessage(plyID, index) {
    return this.removeComment("chatlog", plyID, index);
  }

  addNote(message) {
    return this.addComment("notes", message);
  }

  editNote(plyID, index, message) {
    return this.editComment("notes", plyID, index, message);
  }

  removeNote(plyID, index) {
    return this.removeComment("notes", plyID, index);
  }

  toggleEvaluation(type, double = false) {
    const ply = this.board.ply;
    const types = { tak: "'", tinue: '"', "?": "?", "!": "!" };
    if (!ply) {
      return false;
    }
    if (!ply.evaluation) {
      if (!(type in types)) {
        return false;
      }
      ply.evaluation = Evaluation.parse(
        types[type] + (double ? types[type] : "")
      );
    } else {
      switch (type) {
        case "tak":
          if (ply.evaluation.tak) {
            ply.evaluation = Evaluation.parse(
              ply.evaluation.text.replace(/[']/g, "")
            );
          } else {
            ply.evaluation = Evaluation.parse(
              ply.evaluation.text.replace(/['"]/g, "") + "'"
            );
          }
          break;
        case "tinue":
          if (ply.evaluation.tinue) {
            ply.evaluation = Evaluation.parse(
              ply.evaluation.text.replace(/['"]/g, "")
            );
          } else {
            ply.evaluation = Evaluation.parse(
              ply.evaluation.text.replace(/[']/g, "") + '"'
            );
          }
          break;
        case "?":
        case "!":
          if (!double && ply.evaluation[type]) {
            ply.evaluation = Evaluation.parse(
              ply.evaluation.text.replace(new RegExp(`[${type}]`, "g"), "")
            );
          } else {
            ply.evaluation = Evaluation.parse(
              double
                ? ply.evaluation.isDouble(type)
                  ? ply.evaluation.text.replace(type + type, type)
                  : ply.evaluation.text.includes(type)
                  ? ply.evaluation.text.replace(type, type + type)
                  : ply.evaluation.text + type + type
                : ply.evaluation.text + type
            );
          }
          break;
        default:
          return false;
      }
    }
    this._updatePTN(true);
    this.board.dirtyPly(ply.id);
    this.board.updatePTNOutput();
    this.board.updatePositionOutput();
  }
}
