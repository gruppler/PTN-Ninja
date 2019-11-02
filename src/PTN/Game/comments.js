import Comment from "../Comment";
import Evaluation from "../Evaluation";

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

  addComment(log, message) {
    message = Comment.parse("{" + message + "}");
    const plyID =
      !this.state.plyID && !this.state.plyIsDone ? -1 : this.state.plyID;
    if (!this[log][plyID]) {
      this[log] = Object.assign({ [plyID]: [message] }, this[log]);
    } else {
      this[log][plyID].push(message);
    }
    this._updatePTN(true);
    return message;
  }

  editComment(log, plyID, index, message) {
    if (this[log][plyID] && this[log][plyID][index]) {
      this[log][plyID][index].message = message;
      this._updatePTN(true);
      return this[log][plyID][index];
    }
    return null;
  }

  removeComment(log, plyID, index) {
    if (this[log][plyID]) {
      if (this[log][plyID].length > 1) {
        this[log][plyID].splice(index, 1);
      } else {
        this[log] = omit(this[log], plyID);
      }
      this._updatePTN(true);
    }
  }

  removePlyComments(plyID) {
    if (this.notes[plyID]) {
      this.notes = omit(this.notes, plyID);
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
    const ply = this.state.ply;
    const types = { tak: "'", tinue: '"', "?": "?", "!": "!" };
    if (!ply) {
      return false;
    }
    if (!ply.evaluation) {
      if (!(type in types)) {
        return false;
      }
      ply.evaluation = Evaluation.parse(types[type]);
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
  }
}
