import { upperFirst, zipObject } from "lodash";

export const HOTKEYS = {
  UI: {
    animateBoard: ["shift", "a"],
    axisLabels: ["x"],
    board3D: ["d"],
    flatCounts: ["f"],
    highlightSquares: ["h"],
    notifyGame: ["g"],
    notifyNotes: ["a"],
    pieceShadows: ["s"],
    showAllBranches: ["shift", "b"],
    showControls: ["c"],
    showMove: ["m"],
    showPTN: ["q"],
    showRoads: ["r"],
    showScrubber: ["shift", "s"],
    showText: ["w"],
    unplayedPieces: ["u"]
  },
  CONTROLS: {
    deletePly: ["del"],
    branch: ["b"],
    first: ["ctrl", "arrowleft"],
    last: ["ctrl", "arrowright"],
    next: ["arrowright"],
    nextHalf: ["shift", "arrowright"],
    playpause: ["space"],
    prev: ["arrowleft"],
    prevHalf: ["shift", "arrowleft"]
  },
  ACTIONS: {
    SAVE: ["ctrl", "s"],
    OPEN: ["ctrl", "o"],
    REDO: ["ctrl", "shift", "z"],
    UNDO: ["ctrl", "z"]
  },
  PIECE: {
    color: ["`"],
    F: ["1"],
    S: ["2"],
    C: ["3"]
  },
  MISC: {
    "Edit Game": ["e"],
    "Embed Game": ["shift" + "e"],
    "Focus Text Input": ["/"],
    Help: ["ctrl" + "shift" + "/"],
    Hotkeys: ["ctrl" + "/"],
    "Load Game": ["l"],
    "New Game": ["n"],
    Preferences: ["p"],
    Share: ["ctrl", "shift", "s"]
  }
};

export const HOTKEYS_FORMATTED = zipObject(
  Object.keys(HOTKEYS),
  Object.values(HOTKEYS).map(category =>
    zipObject(
      Object.keys(category),
      Object.values(category).map(keys => keys.map(upperFirst).join(" + "))
    )
  )
);
