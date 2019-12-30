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
    backspacePly: ["backspace"],
    branchMenu: ["b"],
    selectBranch: ["0-9"],
    prevBranch: ["arrowup"],
    nextBranch: ["arrowdown"],
    prevBranchEnd: ["shift", "arrowup"],
    nextBranchEnd: ["shift", "arrowdown"],
    firstBranch: ["ctrl", "arrowup"],
    lastBranch: ["ctrl", "arrowdown"],
    firstBranchEnd: ["ctrl", "shift", "arrowup"],
    lastBranchEnd: ["ctrl", "shift", "arrowdown"]
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
    fullscreen: ["shift", "f"],
    preferences: ["p"],
    newGame: ["n"],
    loadGame: ["l"],
    loadOnlineGame: ["shift", "o"],
    editGame: ["e"],
    editPTN: ["shift", "e"],
    share: ["ctrl", "shift", "s"],
    online: ["o"],
    embedGame: ["ctrl", "e"],
    qrCode: ["shift", "q"],
    focusText: ["/"],
    focusGame: ["\\"],
    previousGame: ["alt", "\\"],
    toggleText: ["shift", "w"],
    more: ["shift", "space"]
  },
  EVAL: {
    tak: ["'"],
    tinue: ["shift", '"'],
    question: ["shift", "?"],
    questionDouble: ["alt", "shift", "?"],
    bang: ["shift", "!"],
    bangDouble: ["alt", "shift", "!"]
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
    branchMenu: "Show Branch Menu",
    selectBranch: "Select Branch",
    prevBranch: "Previous Branch",
    nextBranch: "Next Branch",
    prevBranchEnd: "Previous Branch End",
    nextBranchEnd: "Next Branch End",
    firstBranch: "First Branch",
    lastBranch: "Last Branch",
    firstBranchEnd: "First Branch End",
    lastBranchEnd: "Last Branch End"
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
  EVAL: {
    tak: "Tak",
    tinue: "Tinue",
    question: "?",
    questionDouble: "??",
    bang: "!",
    bangDouble: "!!"
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
    fullscreen: "Fullscreen",
    preferences: "Preferences",
    newGame: "New Game",
    loadGame: "Load Game",
    loadOnlineGame: "Load Online Game",
    editGame: "Edit Game",
    editPTN: "Edit PTN",
    share: "Share",
    online: "Play Online",
    embedGame: "Embed",
    qrCode: "QR Code",
    focusText: "Focus Text Input",
    focusGame: "Focus Game Selector",
    previousGame: "Previous Game",
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
