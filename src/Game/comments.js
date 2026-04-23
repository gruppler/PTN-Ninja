import Comment from "./PTN/Comment";
import Evaluation from "./PTN/Evaluation";

import { isFunction, omit } from "lodash";

export default class GameComments {
  // Detect PV format from existing comments
  // Returns "new" if any comment uses pv> format
  // Returns "old" if any comment uses pv format (without >)
  // Returns null if no PV comments exist (will use new format for new analysis)
  get pvFormat() {
    for (const plyID in this.notes) {
      for (const note of this.notes[plyID]) {
        if (note.pvAfter !== null) {
          return "new";
        }
        if (note.pv !== null) {
          return "old";
        }
      }
    }
    return null;
  }

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
    message = Comment.parse("{" + message + "}");
    if (plyID === undefined) {
      plyID =
        this.board.plyIndex <= 0 && !this.board.plyIsDone
          ? -1
          : this.board.plyID;
    } else if (!(plyID in this.plies) && Number(plyID) !== -1) {
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
            const toRemove = comments.filter((comment) => filter(comment, id));
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

  // Batch remove specific notes and add new ones in a single undo entry.
  // removals: array of { plyID, index } to remove (processed in reverse index order per ply)
  // additions: { [plyID]: [message, ...] } to add
  replaceNotes(removals, additions) {
    // Group removals by plyID and sort indices descending so splicing is safe
    const byPly = {};
    for (const { plyID, index } of removals) {
      (byPly[plyID] || (byPly[plyID] = [])).push(index);
    }
    for (const plyID in byPly) {
      const indices = byPly[plyID].sort((a, b) => b - a);
      for (const idx of indices) {
        if (this.notes[plyID]) {
          if (this.notes[plyID].length > 1) {
            this.notes[plyID].splice(idx, 1);
          } else {
            this.notes = omit(this.notes, plyID);
          }
          this.board.dirtyComment("notes", plyID);
        }
      }
    }
    // Add new notes
    if (additions) {
      const isEvaluation = /^[?!'"]+$/;
      const isReplacement = /^!r(\d+):/;
      for (const plyID in additions) {
        additions[plyID].forEach((message) => {
          if (isEvaluation.test(message)) {
            this._setEvaluation(plyID, message);
          } else {
            if (isReplacement.test(message)) {
              let index = message.match(isReplacement)[1];
              message = message.substring(index.length + 3);
              this._replaceComment("notes", plyID, index, message);
            } else {
              this._addComment("notes", message, plyID);
            }
          }
        });
      }
    }
    this._updatePTN(true);
    this.board.updateCommentsOutput();
    this.board.updatePTNOutput();
    this.board.updatePositionOutput();
  }

  setNotes(plyID, messages) {
    // Clear existing notes for this ply and set new ones
    this.removePlyComments(plyID);
    if (messages && messages.length) {
      messages.forEach((message) => {
        this._addComment("notes", message, plyID);
      });
    }
    this._updatePTN(true);
    this.board.updateCommentsOutput();
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

  // Remove analysis note for a specific suggestion
  // For old format notes that have both eval and pv, we edit to remove just the pv
  removeAnalysisNote(source) {
    const { plyID, noteIndex, format } = source;
    const notes = this.notes[plyID];
    if (!notes || !notes[noteIndex]) {
      return;
    }

    const note = notes[noteIndex];

    // Check if this note has both evaluation and pv (old format combined)
    // In this case, we should edit the note to remove just the pv, keeping the eval
    if (format === "pv" && note.evaluation !== null && note.pv !== null) {
      // Extract everything before "pv " or "pv=" to keep the eval portion
      const pvIndex = note.message.search(/\bpv(?![>])\s*[=\s]/i);
      if (pvIndex > 0) {
        const newMessage = note.message
          .substring(0, pvIndex)
          .replace(/,\s*$/, "")
          .trim();
        if (newMessage) {
          note.message = newMessage;
          this.board.dirtyComment("notes", plyID);
        } else {
          // Nothing left, delete the whole note
          if (notes.length > 1) {
            notes.splice(noteIndex, 1);
          } else {
            this.notes = omit(this.notes, plyID);
          }
          this.board.dirtyComment("notes", plyID);
        }
      } else {
        // pv is at the start or couldn't find it, delete the whole note
        if (notes.length > 1) {
          notes.splice(noteIndex, 1);
        } else {
          this.notes = omit(this.notes, plyID);
        }
        this.board.dirtyComment("notes", plyID);
      }
    } else {
      // For new format (pvAfter) or notes without combined eval+pv, just delete
      if (notes.length > 1) {
        notes.splice(noteIndex, 1);
      } else {
        this.notes = omit(this.notes, plyID);
      }
      this.board.dirtyComment("notes", plyID);
    }

    // For old format PV notes, also find and handle the eval note on the previous ply
    // The eval for this position is on the ply whose tpsAfter matches this ply's tpsBefore
    if (format === "pv") {
      const ply = this.plies[Number(plyID)];
      if (ply && ply.tpsBefore) {
        const tps = ply.tpsBefore;
        // Find the ply whose tpsAfter matches this position's TPS
        // OR for initial position, ply 0 where tpsBefore matches
        let evalPlyID = null;
        for (let i = 0; i < this.plies.length; i++) {
          const p = this.plies[i];
          if (!p) continue;
          if (p.tpsAfter === tps || (p.id === 0 && p.tpsBefore === tps)) {
            evalPlyID = p.id;
            break;
          }
        }
        if (evalPlyID !== null && this.notes[evalPlyID]) {
          const evalNotes = this.notes[evalPlyID];
          const evalNoteIndex = evalNotes.findIndex(
            (n) => n.evaluation !== null
          );
          if (evalNoteIndex !== -1) {
            const evalNote = evalNotes[evalNoteIndex];
            // If this eval note also has a pv, edit to keep just the pv
            if (evalNote.pv !== null) {
              // Extract everything from "pv " onwards to keep the pv portion
              const pvIndex = evalNote.message.search(/\bpv(?![>])\s*[=\s]/i);
              if (pvIndex >= 0) {
                const newEvalMessage = evalNote.message
                  .substring(pvIndex)
                  .trim();
                if (newEvalMessage) {
                  evalNote.message = newEvalMessage;
                  this.board.dirtyComment("notes", evalPlyID);
                } else {
                  // Nothing left, delete the whole note
                  if (evalNotes.length > 1) {
                    evalNotes.splice(evalNoteIndex, 1);
                  } else {
                    this.notes = omit(this.notes, evalPlyID);
                  }
                  this.board.dirtyComment("notes", evalPlyID);
                }
              } else {
                // Couldn't find pv, delete the whole note
                if (evalNotes.length > 1) {
                  evalNotes.splice(evalNoteIndex, 1);
                } else {
                  this.notes = omit(this.notes, evalPlyID);
                }
                this.board.dirtyComment("notes", evalPlyID);
              }
            } else {
              // No pv, just delete the eval note
              if (evalNotes.length > 1) {
                evalNotes.splice(evalNoteIndex, 1);
              } else {
                this.notes = omit(this.notes, evalPlyID);
              }
              this.board.dirtyComment("notes", evalPlyID);
            }
          }
        }
      }
    }

    this._updatePTN(true);
    this.board.updateCommentsOutput();
  }

  removeEvalMarks() {
    let changed = false;
    for (let i = 0; i < this.plies.length; i++) {
      const ply = this.plies[i];
      if (!ply || !ply.evaluation) continue;
      if (
        ply.evaluation.tak ||
        ply.evaluation.tinue ||
        ply.evaluation["?"] ||
        ply.evaluation["!"]
      ) {
        ply.evaluation = null;
        this.board.dirtyPly(ply.id);
        changed = true;
      }
    }
    if (changed) {
      this._updatePTN(true);
      this.board.updatePTNOutput();
      this.board.updatePositionOutput();
    }
    return changed;
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
