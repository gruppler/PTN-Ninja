import { zipObject } from "lodash";

export const GAME_STATE_PROPS = ["targetBranch", "plyID", "plyIsDone"];

export const HOTKEYS = {
  UI: {
    axisLabels: ["x"],
    board3D: ["d"],
    flatCounts: ["f"],
    highlightSquares: ["h"],
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
  Object.values(HOTKEYS).map(group =>
    zipObject(
      Object.keys(group),
      Object.values(group).map(keys =>
        keys.map(key => key[0].toUpperCase() + key.substr(1)).join(" + ")
      )
    )
  )
);
