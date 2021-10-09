import { colors } from "quasar";
import { forEach, isObject, isFunction, pick } from "lodash";

export const PRIMARY_COLOR_IDS = [
  "primary",
  "secondary",
  "ui",
  "player1",
  "player2",
];
export const HIDDEN_COLOR_IDS = ["bg", "player1clear", "player2clear"];

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
  colors.lighten(c, isLightLight(c) ? -15 : isDarkDark(c) ? 15 : 15);

export const COMPUTED = {
  primary: {
    primaryDark: isDark,
  },
  secondary: {
    secondaryDark: isDark,
    colors: {
      bg: (c) => colors.changeAlpha(c, 1),
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
  },
  player1: {
    player1Dark: isDark,
    colors: {
      player1clear: (c) => colors.changeAlpha(c, -1),
      player1road: computeRoad,
      player1flat: computeFlat,
      player1special: computeSpecial,
      player2border: computeFlat,
    },
  },
  player2: {
    player2Dark: isDark,
    colors: {
      player2clear: (c) => colors.changeAlpha(c, -1),
      player2road: computeRoad,
      player2flat: computeFlat,
      player2special: computeSpecial,
      player1border: computeFlat,
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
          (HIDDEN_COLOR_IDS.includes(toVar) ||
            !missingOnly ||
            !(toVar in theme[toKey]))
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
    id: "aer",
    boardStyle: "diamonds1",
    boardChecker: false,
    vars: { "piece-border-width": 1 },
    colors: {
      primary: "#fccc90",
      secondary: "#cadede",
      ui: "#9fbebf",
      accent: "#a9cbcc",
      panel: "#d3e0e0ab",
      board1: "#b6cdcf",
      board2: "#adc2c4",
      board3: "#b6cdcf88",
      player1: "#e9ecd1",
      player1road: "#e9ecd1",
      player1flat: "#dde0c7",
      player1special: "#f7e7b5",
      player1border: "#6c8481",
      player2: "#526e6b",
      player2road: "#526e6b",
      player2flat: "#6c8481",
      player2special: "#354a48",
      player2border: "#131c1b",
      textLight: "#fafafacd",
      textDark: "#212121cd",
      umbra: "#00000033",
    },
  },
  {
    id: "aether",
    boardStyle: "blank",
    boardChecker: false,
    vars: { "piece-border-width": 1 },
    colors: {
      primary: "#ffffffbb",
      secondary: "#000000",
      ui: "#000000bb",
      accent: "#030303",
      panel: "#000000cc",
      board1: "#ffffff44",
      board2: "#000000",
      board3: "#000000",
      player1: "#ffffff",
      player1road: "#ffffff99",
      player1flat: "#f2f2f2",
      player1special: "#ffffffcc",
      player1border: "#262626",
      player2: "#000000",
      player2road: "#000000",
      player2flat: "#262626",
      player2special: "#000000cc",
      player2border: "#f2f2f2",
      textLight: "#ffffff",
      textDark: "#000000",
      umbra: "#00000033",
    },
  },
  {
    id: "aqua",
    boardStyle: "diamonds3",
    boardChecker: true,
    vars: { "piece-border-width": 1 },
    colors: {
      primary: "#6cebc9",
      secondary: "#305f6e",
      ui: "#508a94cc",
      accent: "#44757e",
      panel: "#387185b0",
      board1: "#66c8d9",
      board2: "#5dc0de",
      board3: "#458ca3",
      player1: "#beede3",
      player1road: "#beeddd",
      player1flat: "#b5e1d2",
      player1special: "#abd5c7",
      player1border: "#364b5a",
      player2: "#132b3d",
      player2road: "#364b5a",
      player2flat: "#364b5a",
      player2special: "#2b4050",
      player2border: "#b5e1d2",
      textLight: "#fafafacd",
      textDark: "#212121cd",
      umbra: "#00000033",
    },
  },
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
    id: "discord",
    boardStyle: "diamonds3",
    boardChecker: false,
    vars: { "piece-border-width": 1 },
    colors: {
      primary: "#43b581",
      secondary: "#36393f00",
      ui: "#292b2f",
      accent: "#202225",
      panel: "#40444bcc",
      board1: "#727479",
      board2: "#6c6e73",
      board3: "#54575c",
      player1: "#d6d6d6",
      player1road: "#d6d6d6",
      player1flat: "#cbcbcb",
      player1special: "#c1c1c1",
      player1border: "#2d2d2d",
      player2: "#080808",
      player2road: "#2d2d2d",
      player2flat: "#2d2d2d",
      player2special: "#212121",
      player2border: "#cbcbcb",
      textLight: "#fafafac0",
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
    vars: { "piece-border-width": 1 },
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
      player1border: "#525252",
      player2: "#333333",
      player2road: "#525252",
      player2flat: "#525252",
      player2special: "#474747",
      player2border: "#f2f2f2",
      textLight: "#fafafacd",
      textDark: "#212121cd",
      umbra: "#00000033",
    },
  },
  {
    id: "ignis",
    boardStyle: "diamonds1",
    boardChecker: true,
    vars: { "piece-border-width": 1 },
    colors: {
      primary: "#fde577",
      secondary: "#330721",
      ui: "#2c112b",
      accent: "#371d36",
      panel: "#73144bab",
      board1: "#b81f34aa",
      board2: "#ab1d30aa",
      board3: "#c72a4088",
      player1: "#c72a40",
      player1road: "#ff6c40",
      player1flat: "#d9273f",
      player1special: "#ff6c40",
      player1border: "#fde577",
      player2: "#520833",
      player2road: "#520833",
      player2flat: "#520833",
      player2special: "#2c112b",
      player2border: "#c72a40",
      textLight: "#fff7d1cc",
      textDark: "#212121cd",
      umbra: "#00000033",
    },
  },
  {
    id: "neon",
    boardStyle: "grid3",
    boardChecker: true,
    vars: { "piece-border-width": 2 },
    colors: {
      primary: "#971ec7",
      secondary: "#300c2b",
      ui: "#1c0713",
      accent: "#27131f",
      panel: "#4f304bcc",
      board1: "#6b3f65",
      board2: "#61385a",
      board3: "#4f304b",
      player1: "#da8ff7",
      player1road: "#b41df0",
      player1flat: "#523143",
      player1special: "#7d516b",
      player1border: "#c24df0",
      player2: "#240216",
      player2road: "#240216",
      player2flat: "#21151c",
      player2special: "#120d10",
      player2border: "#54464f",
      textLight: "#e6a6ffff",
      textDark: "#000000cd",
      umbra: "#00000055",
    },
  },
  {
    id: "print",
    boardStyle: "grid1",
    boardChecker: false,
    vars: { "piece-border-width": 1 },
    colors: {
      primary: "#6683d1",
      secondary: "#ffffff",
      ui: "#eeeeee",
      accent: "#cacaca",
      panel: "#b8b8b8cc",
      board1: "#c8c8c8",
      board2: "#b8b8b8",
      board3: "#b8b8b8",
      player1: "#eeeeee",
      player1road: "#ffffff",
      player1flat: "#e8e8e8",
      player1special: "#ffffff",
      player1border: "#606060",
      player2: "#444444",
      player2road: "#606060",
      player2flat: "#606060",
      player2special: "#575757",
      player2border: "#e8e8e8",
      textLight: "#fafafacd",
      textDark: "#212121cd",
      umbra: "#00000022",
    },
  },
  {
    id: "retro",
    boardStyle: "grid1",
    boardChecker: false,
    vars: { "piece-border-width": 1 },
    colors: {
      primary: "#a87419",
      secondary: "#4d4d4d",
      ui: "#212121",
      accent: "#2c2c2c",
      panel: "#686868cc",
      board1: "#858585cc",
      board2: "#686868",
      board3: "#686868",
      player1: "#d1d1d1",
      player1road: "#d1d1d1",
      player1flat: "#c7c7c7",
      player1special: "#bcbcbc",
      player1border: "#424242",
      player2: "#212121",
      player2road: "#424242",
      player2flat: "#424242",
      player2special: "#373737",
      player2border: "#c7c7c7",
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
      player1border: "#262626",
      player2: "#000000",
      player2road: "#262626",
      player2flat: "#262626",
      player2special: "#1a1a1a",
      player2border: "#a2a2a2",
      textLight: "#fafafa99",
      textDark: "#212121cd",
      umbra: "#00000033",
    },
  },
  {
    id: "terra",
    boardStyle: "grid3",
    boardChecker: true,
    vars: { "piece-border-width": 1 },
    colors: {
      primary: "#e0b075",
      secondary: "#756653",
      ui: "#3f4d3f",
      accent: "#364136",
      panel: "#799d79cc",
      board1: "#90af90",
      board2: "#8cab8c",
      board3: "#799d79",
      player1: "#ddf0dd",
      player1road: "#ddf0dd",
      player1flat: "#d2e4d2",
      player1special: "#e1f2e1",
      player1border: "#545e54",
      player2: "#364136",
      player2road: "#545e54",
      player2flat: "#545e54",
      player2special: "#363d36",
      player2border: "#101210",
      textLight: "#fafafacd",
      textDark: "#212121cd",
      umbra: "#00000033",
    },
  },
  {
    id: "zen",
    boardStyle: "grid3",
    boardChecker: false,
    vars: { "piece-border-width": 1 },
    colors: {
      primary: "#6ca130",
      secondary: "#dddddd",
      ui: "#eeeeee",
      accent: "#cacaca",
      panel: "#bcbcbccc",
      board1: "#b5b5b5",
      board2: "#bcbcbc",
      board3: "#bcbcbc",
      player1: "#ffffff",
      player1road: "#ffffff",
      player1flat: "#f2f2f2",
      player1special: "#ffffff",
      player1border: "#c7c7c7",
      player2: "#444444",
      player2road: "#606060",
      player2flat: "#606060",
      player2special: "#454444",
      player2border: "#171717",
      textLight: "#fafafacd",
      textDark: "#212121cd",
      umbra: "#00000055",
    },
  },
].map((theme) => computeMissing({ ...theme, isBuiltIn: true }));
