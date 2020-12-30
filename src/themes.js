import { colors } from "quasar";
import { forEach, isObject, isFunction, pick } from "lodash";

export const PRIMARY_COLOR_IDS = [
  "primary",
  "secondary",
  "ui",
  "player1",
  "player2",
];

const LIGHT = 0.6;
const MED = 0.4;
const DARK = 0.06;

const isLightLight = function (c) {
  return colors.luminosity(c) > LIGHT;
};

const isLight = function (c) {
  return colors.luminosity(c) > MED;
};

const isMedium = function (c) {
  const luminosity = colors.luminosity(c);
  return luminosity > DARK && luminosity <= MED;
};

const isDark = function (c) {
  return colors.luminosity(c) <= MED;
};

const isDarkDark = function (c) {
  return colors.luminosity(c) <= DARK;
};

const computeRoad = (c) => colors.lighten(c, isDarkDark(c) ? 15 : 0);
const computeFlat = (c) => colors.lighten(c, isLight(c) ? -5 : 15);
const computeSpecial = (c) =>
  colors.lighten(c, isLightLight(c) ? -10 : isDarkDark(c) ? 10 : 10);
const computeBorder = (c) => colors.lighten(c, isDarkDark(c) ? 30 : -30);

export const COMPUTED = {
  primary: {
    primaryDark: isDark,
  },
  secondary: {
    secondaryDark: isDark,
    colors: {
      panel: (c) =>
        colors.changeAlpha(colors.lighten(c, isDark(c) ? 15 : -15), 0.8),
      board1: (c) => colors.lighten(c, isDark(c) ? 30 : -27),
      board2: (c) => colors.lighten(c, isDark(c) ? 27 : -30),
      board3: (c) => colors.lighten(c, isDark(c) ? 15 : -15),
    },
  },
  ui: {
    isDark,
    colors: {
      accent: (c) => colors.lighten(c, isDarkDark(c) ? 5 : -15),
    },
  },
  accent: {
    accentDark: isDark,
  },
  panel: {
    panelDark: isDark,
    panelMedium: isMedium,
  },
  player1: {
    player1Dark: isDark,
    colors: {
      player1road: computeRoad,
      player1flat: computeFlat,
      player1special: computeSpecial,
      player1border: computeBorder,
    },
  },
  player2: {
    player2Dark: isDark,
    colors: {
      player2road: computeRoad,
      player2flat: computeFlat,
      player2special: computeSpecial,
      player2border: computeBorder,
    },
  },
};

export const computeFrom = (
  theme,
  fromKey,
  missingOnly = false,
  topLevelOnly = false
) => {
  forEach(COMPUTED[fromKey], (compute, toKey) => {
    if (isFunction(compute)) {
      if (fromKey in theme.colors && (!missingOnly || !(toKey in theme))) {
        theme[toKey] = compute(theme.colors[fromKey], theme);
      }
    } else if (!topLevelOnly && isObject(compute)) {
      forEach(compute, (computeVar, toVar) => {
        if (
          fromKey in theme.colors &&
          (!missingOnly || !(toVar in theme[toKey]))
        ) {
          theme[toKey][toVar] = computeVar(theme.colors[fromKey], theme);
        }
      });
    }
  });
};

export const computeMissing = (theme) => {
  Object.keys(COMPUTED).forEach((fromKey) => {
    computeFrom(theme, fromKey, true);
  });
  return theme;
};

export const boardOnly = (theme) => {
  theme = pick(theme, [
    "id",
    "isBuiltIn",
    "boardStyle",
    "boardChecker",
    "vars",
    "colors",
    "player1Dark",
    "player2Dark",
    "secondaryDark",
  ]);
  theme.vars = pick(theme.vars, ["piece-border-width"]);
  theme.colors = pick(theme.colors, [
    "primary",
    "secondary",
    "board1",
    "board2",
    "board3",
    "player1",
    "player1road",
    "player1flat",
    "player1special",
    "player1border",
    "player2",
    "player2road",
    "player2flat",
    "player2special",
    "player2border",
    "textLight",
    "textDark",
    "umbra",
  ]);
  return theme;
};

export const BOARD_STYLES = [
  "blank",
  "diamonds1",
  "diamonds2",
  "diamonds3",
  "grid1",
  "grid2",
  "grid3",
];

export const THEMES = [
  {
    id: "classic",
    boardStyle: "blank",
    boardChecker: true,
    vars: {
      "piece-border-width": 1,
    },
    colors: {
      primary: "#8bc34a",
      secondary: "#607d8b",
      ui: "#263238",
      accent: "#202a2f",
      panel: "#78909cc0",
      board1: "#90a4ae",
      board2: "#8a9faa",
      board3: "#78909c",
      player1: "#cfd8dc",
      player1road: "#cfd8dc",
      player1flat: "#cfd8dc",
      player1special: "#eceff1",
      player1border: "#546e7a",
      player2: "#263238",
      player2road: "#455a64",
      player2flat: "#546e7a",
      player2special: "#455a64",
      player2border: "#263238",
      textLight: "#fafafacd",
      textDark: "#212121cd",
      umbra: "#00000033",
    },
  },
  {
    id: "festive",
    boardStyle: "diamonds1",
    boardChecker: false,
    vars: { "piece-border-width": 2 },
    colors: {
      primary: "#ccba41",
      secondary: "#e8e8e8",
      ui: "#383632",
      accent: "#302e2b",
      panel: "#d6d1b2ba",
      board1: "#9e927a",
      board2: "#ccba41",
      board3: "#b8aa8e",
      player1: "#852424",
      player1road: "#852424",
      player1flat: "#974545",
      player1special: "#913a3a",
      player1border: "#5d1919",
      player2: "#1e4a2a",
      player2road: "#1e4a2a",
      player2flat: "#40654a",
      player2special: "#355c3f",
      player2border: "#15341d",
      textLight: "#fafafacd",
      textDark: "#212121cd",
      umbra: "#00000033",
    },
  },
  {
    id: "fresh",
    boardStyle: "diamonds2",
    boardChecker: true,
    vars: { "piece-border-width": 2 },
    colors: {
      primary: "#37adc4",
      secondary: "#cccccc",
      ui: "#eeeeee",
      accent: "#cacaca",
      panel: "#adadadcc",
      board1: "#b8b8b8",
      board2: "#adadad",
      board3: "#a0a0a0",
      player1: "#ffffff",
      player1road: "#ffffff",
      player1flat: "#f2f2f2",
      player1special: "#e6e6e6",
      player1border: "#b3b3b3",
      player2: "#333333",
      player2road: "#333333",
      player2flat: "#525252",
      player2special: "#474747",
      player2border: "#242424",
      textLight: "#fafafacd",
      textDark: "#212121cd",
      umbra: "#00000033",
    },
  },
  {
    id: "neon",
    boardStyle: "diamonds1",
    boardChecker: true,
    vars: { "piece-border-width": 2 },
    colors: {
      primary: "#8640b8ff",
      secondary: "#2b262eff",
      ui: "#211d24ff",
      accent: "#2c282f",
      panel: "#4b474dcc",
      board1: "#6b676d",
      board2: "#646166",
      board3: "#4b474d",
      player1: "#d1d1d1ff",
      player1road: "#d1d1d1",
      player1flat: "#c7c7c7",
      player1special: "#bcbcbc",
      player1border: "#9a8ea3ff",
      player2: "#1d181fff",
      player2road: "#353336",
      player2flat: "#353336",
      player2special: "#29272a",
      player2border: "#9b3edeff",
      textLight: "#fafafacd",
      textDark: "#212121cd",
      umbra: "#00000033",
    },
  },
  {
    id: "retro",
    boardStyle: "grid1",
    boardChecker: false,
    vars: { "piece-border-width": 1 },
    colors: {
      primary: "#a87419ff",
      secondary: "#303030ff",
      ui: "#212121ff",
      accent: "#2c2c2c",
      panel: "#4f4f4fcc",
      board1: "#686868",
      board2: "#6e6e6e",
      board3: "#4f4f4f",
      player1: "#d1d1d1ff",
      player1road: "#d1d1d1",
      player1flat: "#c7c7c7",
      player1special: "#bcbcbc",
      player1border: "#929292",
      player2: "#212121ff",
      player2road: "#424242",
      player2flat: "#424242",
      player2special: "#373737",
      player2border: "#646464",
      textLight: "#fafafacd",
      textDark: "#212121cd",
      umbra: "#00000033",
    },
  },
  {
    id: "stealth",
    boardStyle: "diamonds3",
    boardChecker: false,
    vars: { "piece-border-width": 1 },
    colors: {
      primary: "#a1350e",
      secondary: "#111111",
      ui: "#000000",
      accent: "#0d0d0d",
      panel: "#454545cc",
      board1: "#585858",
      board2: "#515151",
      board3: "#353535",
      player1: "#ababab",
      player1road: "#ababab",
      player1flat: "#a2a2a2",
      player1special: "#b3b3b3",
      player1border: "#787878",
      player2: "#000000",
      player2road: "#262626",
      player2flat: "#262626",
      player2special: "#1a1a1a",
      player2border: "#4d4d4d",
      textLight: "#fafafa99",
      textDark: "#212121cd",
      umbra: "#00000033",
    },
  },
  {
    id: "zen",
    boardStyle: "grid2",
    boardChecker: false,
    vars: { "piece-border-width": 0 },
    colors: {
      primary: "#6ca130",
      secondary: "#cccccc",
      ui: "#eeeeee",
      accent: "#cacaca",
      panel: "#adadadcc",
      board1: "#b8b8b8",
      board2: "#adadad",
      board3: "#a0a0a0",
      player1: "#ffffff",
      player1road: "#ffffff",
      player1flat: "#f2f2f2",
      player1special: "#e6e6e6",
      player1border: "#b3b3b3",
      player2: "#333333",
      player2road: "#333333",
      player2flat: "#525252",
      player2special: "#474747",
      player2border: "#242424",
      textLight: "#fafafacd",
      textDark: "#212121cd",
      umbra: "#00000055",
    },
  },
].map((theme) => computeMissing({ ...theme, isBuiltIn: true }));
