import { upperFirst, zipObject } from "lodash";

export const HOTKEYS = {
  ACTIONS: {
    UNDO: ["ctrl", "z"],
    REDO: ["ctrl", "shift", "z"],
    SAVE: ["ctrl", "s"],
    OPEN: ["ctrl", "o"]
  },
  CONTROLS: {
    playpause: ["space"],
    prev: ["arrowleft"],
    next: ["arrowright"],
    prevHalf: ["shift", "arrowleft"],
    nextHalf: ["shift", "arrowright"],
    first: ["ctrl", "arrowleft"],
    last: ["ctrl", "arrowright"],
    deletePly: ["del"],
    branch: ["b"],
    selectBranch: ["0-9"]
  },
  UI: {
    showPTN: ["q"],
    showText: ["w"],
    notifyGame: ["g"],
    notifyNotes: ["a"],
    animateBoard: ["shift", "a"],
    showAllBranches: ["shift", "b"],
    axisLabels: ["x"],
    board3D: ["d"],
    showRoads: ["r"],
    highlightSquares: ["h"],
    pieceShadows: ["s"],
    flatCounts: ["f"],
    unplayedPieces: ["u"],
    showMove: ["m"],
    showControls: ["c"],
    showScrubber: ["shift", "s"]
  },
  MISC: {
    help: ["ctrl", "shift", "?"],
    hotkeys: ["ctrl", "/"],
    preferences: ["p"],
    newGame: ["n"],
    loadGame: ["l"],
    editGame: ["e"],
    editPTN: ["shift", "e"],
    share: ["ctrl", "shift", "s"],
    embedGame: ["ctrl", "e"],
    online: ["o"],
    focusText: ["/"],
    toggleText: ["shift", "w"],
    more: ["shift", "space"]
  },
  PIECE: {
    color: ["`"],
    F: ["1"],
    S: ["2"],
    C: ["3"]
  }
};

export const HOTKEY_NAMES = {
  ACTIONS: {
    UNDO: "Undo",
    REDO: "Redo",
    SAVE: "Download",
    OPEN: "Load Files"
  },
  CONTROLS: {
    playpause: "Play/Pause",
    prev: "Backward",
    next: "Forward",
    prevHalf: "Backward Half-Step",
    nextHalf: "Forward Half-Step",
    first: "Beginning",
    last: "End",
    deletePly: "Delete Ply",
    branch: "Show Branch Menu",
    selectBranch: "Select Branch"
  },
  UI: {
    showPTN: "Show PTN",
    showText: "Show Text",
    notifyGame: "Game Notifications",
    notifyNotes: "Note Notifications",
    animateBoard: "Animate Board",
    showAllBranches: "Show All Branches",
    axisLabels: "Axis Labels",
    board3D: "3D Board",
    showRoads: "Road Connections",
    highlightSquares: "Highlight Squares",
    pieceShadows: "Piece Shadows",
    flatCounts: "Flat Counts",
    unplayedPieces: "Unplayed Pieces",
    showMove: "Current Move",
    showControls: "Play Controls",
    showScrubber: "Scrub Bar"
  },
  PIECE: {
    color: "Switch Player",
    F: "Flats",
    S: "Walls",
    C: "Caps"
  },
  MISC: {
    help: "Help",
    hotkeys: "Hotkeys",
    preferences: "Preferences",
    newGame: "New Game",
    loadGame: "Load Game",
    editGame: "Edit Game",
    editPTN: "Edit PTN",
    share: "Share",
    embedGame: "Embed",
    online: "Play Online",
    focusText: "Focus Text Input",
    toggleText: "Switch Text Tab",
    more: "Show More/Less"
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
