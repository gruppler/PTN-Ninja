import Comment from "./PTN/Comment";
import Evaluation from "./PTN/Evaluation";

import { isFunction, omit } from "lodash";

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

  _addComment(type, message, plyID) {
    plyID = Number(plyID);
    message = Comment.parse("{" + message + "}");
    if (plyID === undefined) {
      plyID =
        this.board.plyIndex <= 0 && !this.board.plyIsDone
          ? -1
          : this.board.plyID;
    } else if (!(plyID in this.plies) && plyID !== -1) {
      throw "Invalid plyID";
    }
    if (!this[type][plyID]) {
      // First comment
      this[type] = Object.assign({ [plyID]: [message] }, this[type]);
    } else {
      // Another comment
      this[type][plyID].push(message);
    }
    this.board.dirtyComment(type, plyID);
    return message;
  }

  addComment(type, message, plyID) {
    message = this._addComment(type, message, plyID);
    this._updatePTN(true);
    this.board.updateCommentsOutput();
    return message;
  }

  addComments(type, messages) {
    const isEvaluation = /^[?!'"]+$/;
    const isReplacement = /^!r(\d+):/;
    for (const plyID in messages) {
      messages[plyID].forEach((message) => {
        if (isEvaluation.test(message)) {
          this._setEvaluation(plyID, message);
        } else {
          if (isReplacement.test(message)) {
            let index = message.match(isReplacement)[1];
            message = message.substring(index.length + 3);
            this._replaceComment(type, plyID, index, message);
          } else {
            this._addComment(type, message, plyID);
          }
        }
      });
    }
    this._updatePTN(true);
    this.board.updateCommentsOutput();
    this.board.updatePTNOutput();
    this.board.updatePositionOutput();
  }

  _replaceComment(type, plyID, index, message) {
    if (this[type][plyID] && this[type][plyID][index]) {
      this[type][plyID][index].message = message;
      this.board.dirtyComment(type, plyID);
      return true;
    }
    return false;
  }

  editComment(type, plyID, index, message) {
    if (this._replaceComment(type, plyID, index, message)) {
      this._updatePTN(true);
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

  removeAllComments(type, filter) {
    const _remove = (type) => {
      const ids = Object.keys(this[type]);
      if (ids.length) {
        if (isFunction(filter)) {
          let hasRemoved = false;
          ids.forEach((id) => {
            let comments = this[type][id];
            const toRemove = comments.filter(filter);
            if (toRemove.length) {
              comments = comments.filter((c) => !toRemove.includes(c));
              if (comments.length === 0) {
                this[type] = omit(this[type], id);
              } else {
                this[type][id] = comments;
              }
              this.board.dirtyComment(type, id);
              hasRemoved = true;
            }
          });
          return hasRemoved;
        } else {
          ids.forEach((id) => {
            this.board.dirtyComment(type, id);
          });
          this[type] = {};
          return true;
        }
      }
      return false;
    };
    if (type) {
      if (_remove(type)) {
        this._updatePTN(true);
        this.board.updateCommentsOutput();
      }
    } else {
      if (["notes", "chatlog"].some(_remove)) {
        this._updatePTN(true);
        this.board.updateCommentsOutput();
      }
    }
  }

  addChatMessage(message, plyID) {
    return this.addComment("chatlog", message, plyID);
  }

  editChatMessage(plyID, index, message) {
    return this.editComment("chatlog", plyID, index, message);
  }

  removeChatMessage(plyID, index) {
    return this.removeComment("chatlog", plyID, index);
  }

  addNote(message, plyID) {
    return this.addComment("notes", message, plyID);
  }

  addNotes(messages) {
    return this.addComments("notes", messages);
  }

  editNote(plyID, index, message) {
    return this.editComment("notes", plyID, index, message);
  }

  removeNote(plyID, index) {
    return this.removeComment("notes", plyID, index);
  }

  removeNotes(filter) {
    return this.removeAllComments("notes", filter);
  }

  _setEvaluation(plyID, notation) {
    const ply = this.plies[plyID];
    if (!ply) {
      throw "Invalid plyID";
    }
    if (ply.evaluation) {
      if (ply.evaluation.tinue && !/''|"/.test(notation)) {
        notation += '"';
      } else if (ply.evaluation.tak && !notation.includes("'")) {
        notation += "'";
      }
    }
    ply.evaluation = Evaluation.parse(notation);
    this.board.dirtyPly(ply.id);
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
