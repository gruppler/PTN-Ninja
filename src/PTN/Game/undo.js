import Diff from "diff-match-patch";
import { isEqual } from "lodash";

const diff = new Diff();
const maxHistoryLength = 10;

export default class GameUndo {
  _applyPatch(patch, state) {
    const result = diff.patch_apply(patch, this.ptn);
    if (result && result.length) {
      this.init(result[0], { ...this, state });
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
