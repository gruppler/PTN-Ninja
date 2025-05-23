import { LocalStorage, Platform } from "quasar";
import { cloneDeep, pick } from "lodash";
import { THEMES } from "../../themes";

let defaults = {
  offline: !navigator.onLine,
  analysisSections: {
    botSuggestions: false,
    dbMoves: false,
    dbGames: false,
  },
  dbSettings: {
    includeBotGames: false,
    player1: [],
    player2: [],
    minRating: null,
    komi: [],
    maxSuggestedMoves: 8,
    tournament: null,
    minDate: null,
    maxDate: null,
  },
  botSettings: {
    bot: "tiltak-cloud",
    tiltak: {
      pvLimit: 3,
    },
    "tiltak-cloud": {
      maxSuggestedMoves: 8,
      pvLimit: 3,
    },
    topaz: {
      depth: 12,
      timeBudget: 30,
      pvLimit: 3,
    },
    tei: {
      log: false,
      ssl: window.location.protocol.includes("s"),
      address: "localhost",
      port: 7731,
      pvLimit: 3,
    },
  },
  animateBoard: true,
  animateScrub: false,
  axisLabels: true,
  board3D: false,
  boardRotation: [0, 0.65],
  boardSpace: { width: 0, height: 0 },
  boardTransform: [0, 0],
  editingBranch: "",
  editHeader: false,
  firstMoveNumber: 1,
  flatCounts: true,
  highlightSquares: true,
  highlighterColor: "",
  highlighterCustomColor: "",
  highlighterEnabled: false,
  highlighterSquares: {},
  isPortrait: false,
  komi: 0,
  moveNumber: true,
  evalText: true,
  nativeSharing:
    navigator.canShare && !Platform.is.desktop
      ? navigator.canShare({ text: "test", url: location.href })
      : false,
  notifyGame: true,
  notifyNotes: true,
  openDuplicate: "replace",
  orthogonal: false,
  perspective: 5,
  playSpeed: 60, //FPM
  player1: "",
  player2: "",
  playerName: "",
  scrollScrubbing: Platform.is.desktop,
  scrollThreshold: 0,
  selectedPiece: { color: 1, type: "F" },
  showAllBranches: false,
  showBoardPrefsBtn: false,
  showControls: true,
  showPlayButton: true,
  showEval: true,
  showHints: true,
  showMove: true,
  showPTN: true,
  showRoads: true,
  showScrubber: false,
  showText: false,
  size: "6",
  stackCounts: false,
  hasChat: false,
  textTab: "notes",
  themeID: "classic",
  theme: THEMES.find((t) => t.id === "classic"),
  themes: [],
  turnIndicator: true,
  unplayedPieces: true,
};

export const embedUIOptions = [
  "axisLabels",
  "flatCounts",
  "turnIndicator",
  "highlightSquares",
  "moveNumber",
  "evalText",
  "playSpeed",
  "showAllBranches",
  "showMove",
  "showControls",
  "showPlayButton",
  "showPTN",
  "showRoads",
  "showScrubber",
  "showText",
  "stackCounts",
  "themeID",
  "unplayedPieces",
];
defaults.embedConfig = {
  width: "100%",
  height: "600px",
  includeNames: false,
  state: true,
  ui: pick(defaults, embedUIOptions),
};

export const imgUIOptions = [
  "axisLabels",
  "flatCounts",
  "turnIndicator",
  "highlightSquares",
  "moveNumber",
  "evalText",
  "showRoads",
  "stackCounts",
  "themeID",
  "unplayedPieces",
];

defaults.gifConfig = {
  plyRange: { min: 0, max: 4 },
  playSpeed: 60, //FPM
  imageSize: "md",
  textSize: "md",
  includeNames: true,
  padding: true,
  transparent: false,
  ...pick(defaults, imgUIOptions),
};
defaults.pngConfig = {
  imageSize: "md",
  textSize: "md",
  includeNames: true,
  padding: true,
  bgAlpha: 1,
  ...pick(defaults, imgUIOptions),
};

export const onlineUIOptions = [
  "playerName",
  "flatCounts",
  "showRoads",
  "stackCounts",
];
defaults.onlineConfig = {
  isPrivate: true,
  playerSeat: "random",
  scratchboard: true,
  ...pick(defaults, onlineUIOptions),
};

let state = {
  embed: Platform.within.iframe,
  scrubbing: false,
  thumbnails: {},
  shortLinks: {},
  defaults,
  ...cloneDeep(defaults),
};

// Load from LocalStorage
const load = (key, initial) =>
  LocalStorage.has(key) ? LocalStorage.getItem(key) : initial;

if (!state.embed && !LocalStorage.isEmpty()) {
  for (let key in defaults) {
    state[key] = load(key, state[key]);
  }
}

// Backward compatibility
if (
  !(state.botSettings.bot in state.botSettings) &&
  state.botSettings.bot in defaults.botSettings
) {
  const botSettings = cloneDeep(defaults.botSettings);
  for (const bot in botSettings) {
    if (bot === "bot") {
      continue;
    }
    Object.assign(
      botSettings[bot],
      pick(state.botSettings, Object.keys(botSettings[bot]))
    );
  }
  state.botSettings = botSettings;
}

export default state;
