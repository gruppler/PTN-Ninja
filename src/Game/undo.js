import Diff from "diff-match-patch";
import { isEqual } from "lodash";

const diff = new Diff();
const maxHistoryLength = 10;

export default class GameUndo {
  _applyPatch(patch, state) {
    let ptn;
    try {
      ptn = diff.patch_apply(patch, this.ptn)[0];
    } catch (error) {
      console.error(error);
    }
    if (ptn) {
      this.init({ ...this.params, ptn, state });
    }
  }

  get canUndo() {
    return this.historyIndex > 0;
  }

  get canRedo() {
    return this.historyIndex < this.history.length;
  }

  undo() {
    if (!this.canUndo) {
      return false;
    }
    const history = this.history[--this.historyIndex];
    this._applyPatch(diff.patch_fromText(history.undoPatch), history.state);
    this.board.updateOutput();
    return true;
  }

  redo() {
    if (!this.canRedo) {
      return false;
    }
    const history = this.history[this.historyIndex++];
    this._applyPatch(
      diff.patch_fromText(history.patch),
      history.afterState || history.state
    );
    this.board.updateOutput();
    return true;
  }

  recordChange(mutate) {
    const before = {
      state: this.minState,
      ptn: this.ptn,
    };
    mutate.call(this);
    const patch = diff.patch_toText(diff.patch_make(before.ptn, this.ptn));
    if (patch) {
      this.history.length = this.historyIndex;
      this.history.push(
        Object.freeze({
          state: before.state,
          patch,
          undoPatch: diff.patch_toText(diff.patch_make(this.ptn, before.ptn)),
          afterState: isEqual(before.state, this.minState)
            ? undefined
            : this.minState,
        })
      );
      this.historyIndex++;
      if (this.history.length > maxHistoryLength) {
        this.history.shift();
        this.historyIndex = this.history.length;
      }
    }
  }

  clearHistory() {
    this.history.length = this.historyIndex = 0;
  }
}
