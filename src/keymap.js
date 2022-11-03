import { forEach, upperFirst } from "lodash";

export const HOTKEYS = {
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
    lastBranchEnd: ["ctrl", "shift", "arrowdown"],
  },
  DIALOGS: {
    account: ["ctrl", "shift", "a"],
    configPNG: ["ctrl", "p"],
    editGame: ["e"],
    editPTN: ["shift", "e"],
    embedGame: ["ctrl", "e"],
    gameInfo: ["i"],
    help: ["ctrl", "shift", "?"],
    hotkeys: ["ctrl", "/"],
    newGame: ["n"],
    loadGame: ["l"],
    loadOnlineGame: ["o"],
    shareOnline: ["shift", "o"],
    preferences: ["p"],
    qrCode: ["shift", "q"],
    theme: ["shift", "t"],
  },
  EVAL: {
    tak: ["'"],
    tinue: ["shift", '"'],
    question: ["shift", "?"],
    questionDouble: ["alt", "shift", "?"],
    bang: ["shift", "!"],
    bangDouble: ["alt", "shift", "!"],
  },
  PIECE: {
    color: ["`"],
    F: ["1"],
    S: ["2"],
    C: ["3"],
  },
  SHARING: {
    exportPNG: ["ctrl", "shift", "p"],
    exportPTN: ["ctrl", "s"],
    share: ["ctrl", "shift", "c"],
    sharePTN: ["ctrl", "alt", "c"],
    shareTPS: ["ctrl", "c"],
    shareURL: ["alt", "c"],
  },
  TRANSFORMS: {
    resetTransform: ["="],
    rotate180: ["-"],
    rotateLeft: ["["],
    rotateRight: ["]"],
    flipHorizontal: [";"],
    flipVertical: ["shift", ":"],
  },
  UI: {
    showHints: ["shift", "h"],
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
    turnIndicator: ["t"],
    flatCounts: ["f"],
    stackCounts: ["s"],
    moveNumber: ["shift", "m"],
    unplayedPieces: ["u"],
    showMove: ["m"],
    showControls: ["c"],
    showScrubber: ["shift", "s"],
  },
  MISC: {
    "game/UNDO": ["ctrl", "z"],
    "game/REDO": ["ctrl", "shift", "z"],
    "ui/OPEN": ["ctrl", "o"],
    fullscreen: ["shift", "f"],
    focusText: ["/"],
    focusGame: ["\\"],
    previousGame: ["alt", "\\"],
    toggleText: ["shift", "w"],
    more: ["shift", "space"],
  },
};

export const HOTKEY_NAMES = {
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
    lastBranchEnd: "Last Branch End",
  },
  DIALOGS: {
    account: "Account",
    configPNG: "Configure PNG",
    editGame: "Edit Game",
    editPTN: "Edit PTN",
    embedGame: "Embed",
    gameInfo: "Game Info",
    help: "Help",
    hotkeys: "Hotkeys",
    newGame: "New Game",
    loadGame: "Load Game",
    loadOnlineGame: "Load Online Game",
    shareOnline: "Share or Play Online",
    preferences: "Preferences",
    qrCode: "QR Code",
    theme: "Theme",
  },
  EVAL: {
    tak: "Tak",
    tinue: "Tinue",
    question: "?",
    questionDouble: "??",
    bang: "!",
    bangDouble: "!!",
  },
  PIECE: {
    color: "Switch Player",
    F: "Flats",
    S: "Walls",
    C: "Caps",
  },
  SHARING: {
    exportPNG: "Export PNG Image",
    exportPTN: "Export PTN File",
    share: "Share",
    sharePTN: "Share PTN",
    shareTPS: "Share TPS",
    shareURL: "Share URL",
  },
  TRANSFORMS: {
    resetTransform: "Reset Transformation",
    rotate180: "Rotate 180",
    rotateLeft: "Rotate Left",
    rotateRight: "Rotate Right",
    flipHorizontal: "Flip Horizontally",
    flipVertical: "Flip Vertically",
  },
  UI: {
    showHints: "Show UI Hints",
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
    turnIndicator: "Turn Indicator",
    flatCounts: "Flat Counts",
    stackCounts: "Stack Counts",
    moveNumber: "Move Number",
    unplayedPieces: "Unplayed Pieces",
    showMove: "Current Move",
    showControls: "Play Controls",
    showScrubber: "Scrub Bar",
  },
  MISC: {
    "game/UNDO": "Undo",
    "game/REDO": "Redo",
    "ui/OPEN": "Load Files",
    focusGame: "Focus Game Selector",
    focusText: "Focus Text Input",
    fullscreen: "Fullscreen",
    more: "Show More/Less",
    previousGame: "Previous Game",
    toggleText: "Switch Text Tab",
  },
};

let formatted = { ...HOTKEYS };
forEach(formatted, (category, categoryID) => {
  formatted[categoryID] = { ...category };
  forEach(
    category,
    (keys, id) => (formatted[categoryID][id] = keys.map(upperFirst).join(" + "))
  );
});
export const HOTKEYS_FORMATTED = formatted;
