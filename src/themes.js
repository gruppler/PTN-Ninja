import { i18n } from "./boot/i18n";
import { colors } from "quasar";
import { forEach, isObject, isFunction } from "lodash";

export const BOARD_STYLES = [
  { label: i18n.t("Checker"), value: "checker" },
  { label: i18n.t("Diamonds 1"), value: "diamonds1" },
  { label: i18n.t("Diamonds 2"), value: "diamonds2" },
  { label: i18n.t("Grid 1"), value: "grid1" },
  { label: i18n.t("Grid 2"), value: "grid2" },
];

export const THEMES = [
  {
    id: "classic",
    name: i18n.t("Classic"),
    boardStyle: "checker",
    vars: {
      "piece-border-width": 1,
    },
    colors: {
      primary: "#8bc34aff",
      secondary: "#607d8bff",
      ui: "#263238ff",
      accent: "#202a2fff",
      panel: "#78909cc0",
      board1: "#8a9faaff",
      board2: "#90a4aeff",
      board3: "#78909cff",
      player1: "#cfd8dcff",
      player1road: "#cfd8dcff",
      player1flat: "#cfd8dcff",
      player1special: "#eceff1ff",
      player1border: "#546e7aff",
      player2: "#263238ff",
      player2road: "#455a64ff",
      player2flat: "#546e7aff",
      player2special: "#455a64ff",
      player2border: "#263238ff",
    },
  },
  {
    id: "stealth",
    name: "Stealth",
    boardStyle: "grid1",
    vars: { "piece-border-width": 1 },
    colors: {
      primary: "#a1350eff",
      secondary: "#111111ff",
      ui: "#000000ff",
      accent: "#0d0d0d",
      panel: "#353535cc",
      board1: "#515151",
      board2: "#585858",
      board3: "#353535",
      player1: "#ccccccff",
      player1road: "#cccccc",
      player1flat: "#c2c2c2",
      player1special: "#b8b8b8",
      player1border: "#8f8f8f",
      player2: "#000000ff",
      player2road: "#262626",
      player2flat: "#262626",
      player2special: "#1a1a1a",
      player2border: "#4d4d4d",
    },
  },
  {
    id: "zen",
    name: "Zen",
    boardStyle: "grid2",
    vars: { "piece-border-width": 2 },
    colors: {
      primary: "#6ca130ff",
      secondary: "#ccccccff",
      ui: "#eeeeeeff",
      accent: "#cacaca",
      panel: "#adadadcc",
      board1: "#8f8f8f",
      board2: "#959595",
      board3: "#adadad",
      player1: "#ffffffff",
      player1road: "#ffffff",
      player1flat: "#f2f2f2",
      player1special: "#e6e6e6",
      player1border: "#b3b3b3",
      player2: "#333333ff",
      player2road: "#333333",
      player2flat: "#525252",
      player2special: "#474747",
      player2border: "#242424",
    },
  },
  {
    id: "festive",
    name: "Festive",
    boardStyle: "diamonds1",
    vars: { "piece-border-width": 3 },
    colors: {
      primary: "#ccba41ff",
      secondary: "#d9c8a7ff",
      ui: "#383632ff",
      accent: "#302e2b",
      panel: "#b8aa8ecc",
      board1: "#ccba41ff",
      board2: "#9e927a",
      board3: "#b8aa8e",
      player1: "#852424ff",
      player1road: "#852424",
      player1flat: "#974545",
      player1special: "#913a3a",
      player1border: "#5d1919",
      player2: "#1e4a2aff",
      player2road: "#1e4a2a",
      player2flat: "#40654a",
      player2special: "#355c3f",
      player2border: "#15341d",
    },
  },
];

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
      board1: (c) => colors.lighten(c, isDark(c) ? 27 : -30),
      board2: (c) => colors.lighten(c, isDark(c) ? 30 : -27),
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

export const computeFrom = (theme, fromKey, missingOnly = false) => {
  forEach(COMPUTED[fromKey], (compute, toKey) => {
    if (isFunction(compute)) {
      if (fromKey in theme.colors && (!missingOnly || !(toKey in theme))) {
        theme[toKey] = compute(theme.colors[fromKey], theme);
      }
    } else if (isObject(compute)) {
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
};
