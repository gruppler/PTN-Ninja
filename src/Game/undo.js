import { isEqual } from "lodash";

const maxHistoryLength = 5;

export default class GameUndo {
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
    if (history.beforePTN) {
      this.init({
        ...this.params,
        ptn: history.beforePTN,
        state: history.state,
      });
    }
    this.board.updateOutput();
    return true;
  }

  redo() {
    if (!this.canRedo) {
      return false;
    }
    const history = this.history[this.historyIndex++];
    if (history.afterPTN) {
      this.init({
        ...this.params,
        ptn: history.afterPTN,
        state: history.afterState || history.state,
      });
    }
    this.board.updateOutput();
    return true;
  }

  recordChange(mutate) {
    const before = {
      state: this.minState,
      ptn: this.ptn,
    };
    let result = mutate.call(this);
    if (before.ptn !== this.ptn) {
      this.history.length = this.historyIndex;
      let historyEntry = {
        state: before.state,
        afterState: isEqual(before.state, this.minState)
          ? undefined
          : this.minState,
        beforePTN: before.ptn,
        afterPTN: this.ptn,
      };
      this.history.push(Object.freeze(historyEntry));
      this.historyIndex++;
      if (this.history.length > maxHistoryLength) {
        this.history.shift();
        this.historyIndex = this.history.length;
      }
    }
    return result;
  }

  clearHistory() {
    this.history.length = this.historyIndex = 0;
  }
}
