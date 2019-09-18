import { upperFirst, zipObject } from "lodash";

export const MIN_GAME_STATE_PROPS = ["targetBranch", "plyID", "plyIsDone"];

export const HOTKEYS = {
  UI: {
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
    branch: ["b"],
    first: ["ctrl", "arrowleft"],
    last: ["ctrl", "arrowright"],
    next: ["arrowright"],
    nextHalf: ["shift", "arrowright"],
    playpause: ["space"],
    prev: ["arrowleft"],
    prevHalf: ["shift", "arrowleft"]
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
