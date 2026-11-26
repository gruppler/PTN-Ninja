/**
 * The settings rows of the image, GIF and embed dialogs: which registry
 * entries each offers, the rules that differ from the live board's, and the
 * rows of their own. The `export` store of a scope is the dialog's config,
 * `ui` its board options (the config itself, or the embed's config.ui).
 */

import { localEntry } from "./scope";

// The board options an image or a GIF draws
export const IMAGE_IDS = [
  "ui:highlightSquares",
  "ui:flatWinHighlights",
  "ui:showRoads",
  "ui:stackCounts",
  "ui:centerStackCounts",
  "ui:turnIndicator",
  "ui:flatCounts",
  "ui:moveNumber",
  "ui:evalText",
  "ui:unplayedPieces",
  "ui:axisLabels",
  "ui:axisLabelsSmall",
  "ui:verticalLayout",
  "ui:showAnalysisBoard",
  "ui:boardEvalBar",
];

// The image renderer draws the move number and evaluation text in the
// header beside the unplayed pieces, which needs both, and the evaluation
// bar beside the unplayed pieces, whether the live board's bars are shown
// or not
const requiresHeader = {
  disabledWhen: (state) => !state.ui.turnIndicator || !state.ui.unplayedPieces,
  disabledHint: (state) =>
    state.ui.turnIndicator
      ? "settings.requiresUnplayedPieces"
      : "settings.requiresTurnIndicator",
};
export const IMAGE_OVERRIDES = {
  "ui:moveNumber": requiresHeader,
  "ui:evalText": { ...requiresHeader, dependsOn: undefined },
  "ui:boardEvalBar": {
    dependsOn: undefined,
    disabledWhen: (state) => !state.ui.unplayedPieces,
    disabledHint: "settings.requiresUnplayedPieces",
  },
};

export const playerNames = localEntry("export:includeNames", {
  label: "Player Names",
  dependsOn: "ui:turnIndicator",
});

// The board and app options an embed takes
export const EMBED_IDS = [
  "ui:highlightSquares",
  "ui:flatWinHighlights",
  "ui:showRoads",
  "ui:stackCounts",
  "ui:centerStackCounts",
  "ui:turnIndicator",
  "ui:flatCounts",
  "ui:moveNumber",
  "ui:evalText",
  "ui:unplayedPieces",
  "ui:axisLabels",
  "ui:axisLabelsSmall",
  "ui:verticalLayout",
  "ui:verticalLayoutAuto",
  "ui:showControls",
  "ui:showPlayButton",
  "ui:playSpeed",
  "ui:showScrubber",
  "ui:notifyGame",
  "ui:notifyNotes",
  "ui:notifyAnalysisNotes",
];

// An embed without navigation has no use for its controls
const lockedByDisableNavigation = {
  disabledWhen: (state) => Boolean(state.ui.disableNavigation),
  disabledHint: "settings.lockedByDisableNavigation",
};
export const EMBED_OVERRIDES = {
  "ui:showControls": lockedByDisableNavigation,
  "ui:showPlayButton": lockedByDisableNavigation,
  "ui:playSpeed": lockedByDisableNavigation,
  "ui:showScrubber": lockedByDisableNavigation,
};

// A row the embed's own switch turns off
const lockedBy = (key, hint) => ({
  disabledWhen: (state) => Boolean(state.ui[key]),
  disabledHint: hint,
});

// The embed's own options, in order
export const EMBED_ENTRIES = [
  localEntry("export:state", { label: "Start from Current Position" }),
  localEntry("ui:disableBoard", { label: "Disable Board" }),
  localEntry("ui:disableStoneCycling", {
    label: "Disable Stone Cycling",
    ...lockedBy("disableBoard", "settings.lockedByDisableBoard"),
  }),
  localEntry("ui:disableNavigation", { label: "Disable Navigation" }),
  localEntry("ui:disableUndo", {
    label: "Disable Undo",
    ...lockedByDisableNavigation,
  }),
  localEntry("ui:disableText", { label: "Disable Notes" }),
  localEntry("ui:showText", {
    label: "Show Notes",
    ...lockedBy("disableText", "settings.lockedByDisableNotes"),
  }),
  localEntry("ui:disablePTN", { label: "Disable PTN" }),
  ...[
    ["showPTN", "Show PTN"],
    ["showMove", "Current Move"],
    ["showAllBranches", "Show All Branches"],
    ["disablePTNTools", "Disable PTN Tools"],
  ].map(([key, label]) =>
    localEntry("ui:" + key, {
      label,
      ...lockedBy("disablePTN", "settings.lockedByDisablePTN"),
    })
  ),
  localEntry("ui:showBoardPrefsBtn", { label: "Board Preferences Button" }),
  localEntry("ui:showBoardTransformBtn", { label: "Board Transform Button" }),
  localEntry("ui:showToolbarAnalysisBtn", { label: "Suggestion Bar Button" }),
  // For a host that relies on hearing its own commands back
  localEntry("ui:echoHostCommands", { label: "Echo Host Commands" }),
];
