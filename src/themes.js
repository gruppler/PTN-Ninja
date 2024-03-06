import { colors } from "quasar";
import { defaultsDeep, forEach, isObject, isFunction, pick } from "lodash";

export const PRIMARY_COLOR_IDS = [
  "primary",
  "secondary",
  "ui",
  "player1",
  "player2",
];
export const HIDDEN_COLOR_IDS = [
  "bg",
  "player1clear",
  "player2clear",
  "panelOpaque",
  "panelOpaqueHover",
  "panelClear",
  "panelClearHover",
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
  colors.lighten(c, isLightLight(c) ? -15 : isDarkDark(c) ? 15 : 15);
const computeStoneBorder = (c) =>
  colors.lighten(c, isDarkDark(c) ? 35 : isDark(c) ? -50 : -35);
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
  board1: {
    board1Dark: isDark,
  },
  board2: {
    board2Dark: isDark,
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
    colors: {
      panelOpaque: (c) => colors.changeAlpha(c, 1),
      panelOpaqueHover: (c) =>
        colors.changeAlpha(
          colors.blend(
            isDark(c) ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.075)",
            c
          ),
          1
        ),
      panelClear: (c) => colors.changeAlpha(c, -1),
      panelClearHover: (c) =>
        colors.changeAlpha(
          colors.blend(
            isDark(c) ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.075)",
            c
          ),
          -1
        ),
    },
  },
  player1: {
    player1Dark: isDark,
    colors: {
      player1clear: (c) => colors.changeAlpha(c, -1),
      player1road: computeRoad,
      player1flat: computeFlat,
      player1special: computeSpecial,
      player1border: computeStoneBorder,
    },
  },
  player2: {
    player2Dark: isDark,
    colors: {
      player2clear: (c) => colors.changeAlpha(c, -1),
      player2road: computeRoad,
      player2flat: computeFlat,
      player2special: computeSpecial,
      player2border: computeStoneBorder,
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
  defaultsDeep(theme, {
    boardChecker: false,
    fromCenter: false,
    rings: 0,
    vars: { "piece-border-width": 1, "rings-opacity": 0.25 },
    colors: {
      ring1: theme.isDark ? "#ffffff44" : "#000000aa",
      ring2: theme.isDark ? "#ffffff88" : "#00000077",
      ring3: theme.isDark ? "#ffffffcc" : "#00000044",
      ring4: theme.isDark ? "#ffffffff" : "#00000011",
    },
  });
  return theme;
};

export const boardOnly = (theme) => {
  theme = pick(theme, [
    "id",
    "isBuiltIn",
    "boardStyle",
    "boardChecker",
    "fromCenter",
    "rings",
    "vars",
    "colors",
    "player1Dark",
    "player2Dark",
    "ring1",
    "ring2",
    "ring3",
    "ring4",
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
    "ring1",
    "ring2",
    "ring3",
    "ring4",
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
      primary: "#f0bc7d",
      secondary: "#cadede",
      ui: "#859ca6",
      accent: "#8ba9b5",
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
    boardStyle: "grid1",
    boardChecker: false,
    vars: { "piece-border-width": 2 },
    colors: {
      primary: "#ffffffcc",
      secondary: "#000000",
      ui: "#000000cc",
      accent: "#030303",
      panel: "#5c5c5ccc",
      board1: "#000000",
      board2: "#333333",
      board3: "#00000000",
      player1: "#ffffff",
      player1road: "#ffffffcc",
      player1flat: "#ffffffcc",
      player1special: "#ffffffcc",
      player1border: "#ffffff",
      player2: "#333333",
      player2road: "#666666cc",
      player2flat: "#000000cc",
      player2special: "#000000cc",
      player2border: "#545454",
      textLight: "#ffffff",
      textDark: "#000000",
      umbra: "#00000066",
    },
  },
  {
    id: "aqua",
    boardStyle: "diamonds3",
    boardChecker: false,
    rings: 4,
    vars: {
      "piece-border-width": 3,
      "rings-opacity": 0.25,
    },
    colors: {
      primary: "#d7faee",
      secondary: "#00395c",
      ui: "#517c8fcc",
      accent: "#45697a",
      panel: "#246b85b0",
      board1: "#5cc4d6",
      board2: "#53bcdb",
      board3: "#00395c",
      player1: "#a2de30",
      player1road: "#5e9100",
      player1flat: "#9ad32e",
      player1special: "#beef43",
      player1border: "#31600e",
      player2: "#00bce4",
      player2road: "#00819e",
      player2flat: "#00b3d9",
      player2special: "#26c6e8",
      player2border: "#00667d",
      ring1: "#00000011",
      ring2: "#00000044",
      ring3: "#00000077",
      ring4: "#000000aa",
      textLight: "#c6f7e7cc",
      textDark: "#112430cc",
      umbra: "#0a233633",
    },
  },
  {
    id: "atlas",
    boardStyle: "grid2",
    boardChecker: false,
    fromCenter: true,
    rings: 4,
    vars: {
      "piece-border-width": 1,
      "rings-opacity": 0.4,
    },
    colors: {
      primary: "#baa254",
      secondary: "#d9cfad",
      ui: "#e8e2d8",
      accent: "#537094",
      panel: "#bab2a4cc",
      board1: "#537094",
      board2: "#3d5878",
      board3: "#3d5878",
      player1: "#fff7e8",
      player1road: "#ffffff",
      player1flat: "#fff7e8",
      player1special: "#fff7e8",
      player1border: "#634831",
      player2: "#709c81",
      player2road: "#abd6bb",
      player2flat: "#709c81",
      player2special: "#709c81",
      player2border: "#112e03",
      ring1: "#00000011",
      ring2: "#00000044",
      ring3: "#00000077",
      ring4: "#000000aa",
      textLight: "#ffffffff",
      textDark: "#634831",
      umbra: "#453c3455",
    },
  },
  {
    id: "backlit",
    boardStyle: "grid2",
    boardChecker: false,
    vars: { "piece-border-width": 2 },
    colors: {
      primary: "#6a3582",
      secondary: "#777777cc",
      ui: "#888888",
      accent: "#cacaca",
      panel: "#b8b8b8cc",
      board1: "#888888",
      board2: "#777777",
      board3: "#999999",
      player1: "#eeeeee",
      player1road: "#ffffff",
      player1flat: "#999999",
      player1special: "#999999",
      player1border: "#ffffff",
      player2: "#444444",
      player2road: "#000000",
      player2flat: "#777777",
      player2special: "#777777",
      player2border: "#000000",
      textLight: "#fafafacd",
      textDark: "#212121cd",
      umbra: "#00000022",
    },
  },
  {
    id: "bubbletron",
    boardStyle: "diamonds3",
    boardChecker: false,
    rings: 4,
    vars: {
      "piece-border-width": 2,
      "rings-opacity": 0.25,
    },
    colors: {
      primary: "#1b47f5",
      secondary: "#282033",
      ui: "#202b59",
      accent: "#141d42",
      panel: "#202b59cc",
      board1: "#202b59",
      board2: "#282033",
      board3: "#282033",
      player1: "#e055c3",
      player1road: "#e055c3",
      player1flat: "#202b59cc",
      player1special: "#e055c3",
      player1border: "#e055c3cc",
      player2: "#50ffe1",
      player2road: "#50ffe1",
      player2flat: "#202b59cc",
      player2special: "#50ffe1",
      player2border: "#50ffe1",
      ring1: "#202b5944",
      ring2: "#9b4fff88",
      ring3: "#f7be2dcc",
      ring4: "#c0e055ff",
      textLight: "#fafafacd",
      textDark: "#282033cc",
      umbra: "#28203354",
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
    boardStyle: "grid1",
    boardChecker: false,
    rings: 0,
    vars: { "piece-border-width": 2 },
    colors: {
      primary: "#f0b132",
      secondary: "#313338",
      ui: "#292b2f",
      accent: "#202225",
      panel: "#40444bcc",
      board1: "#65676b",
      board2: "#5b5e63",
      board3: "#54575c",
      player1: "#d6d6d6",
      player1road: "#d6d6d6",
      player1flat: "#cbcbcb",
      player1special: "#c1c1c1",
      player1border: "#363434",
      player2: "#080808",
      player2road: "#2d2d2d",
      player2flat: "#404040",
      player2special: "#333333",
      player2border: "#000000",
      ring1: "#ffffff38",
      ring2: "#ffffff88",
      ring3: "#ffffffcc",
      ring4: "#ffffffff",
      textLight: "#fafafac0",
      textDark: "#212121cd",
      umbra: "#00000033",
    },
  },
  {
    id: "fresh",
    boardStyle: "diamonds1",
    boardChecker: false,
    rings: 0,
    vars: {
      "piece-border-width": 2,
      "rings-opacity": 0.2,
    },
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
      ring1: "#00000011",
      ring2: "#00000044",
      ring3: "#00000077",
      ring4: "#000000aa",
      textLight: "#fafafacd",
      textDark: "#212121cd",
      umbra: "#00000033",
    },
  },
  {
    id: "ignis",
    boardStyle: "diamonds1",
    boardChecker: true,
    rings: 4,
    vars: {
      "piece-border-width": 2,
      "rings-opacity": 0.4,
    },
    colors: {
      primary: "#fde577",
      secondary: "#330721",
      ui: "#2c112b",
      accent: "#371d36",
      panel: "#ffed9eaa",
      board1: "#b81f34aa",
      board2: "#ab1d30aa",
      board3: "#c72a4088",
      player1: "#c72a40",
      player1road: "#ff6c40",
      player1flat: "#ff6c40",
      player1special: "#fde577",
      player1border: "#fde577",
      player2: "#520833",
      player2road: "#520833",
      player2flat: "#690d42",
      player2special: "#3d193c",
      player2border: "#14000cff",
      ring1: "#52083345",
      ring2: "#ff6c4087",
      ring3: "#fde577cc",
      ring4: "#fde577ff",
      textLight: "#fff7d1cc",
      textDark: "#212121cd",
      umbra: "#00000033",
    },
  },
  {
    id: "luna",
    boardStyle: "diamonds3",
    boardChecker: false,
    rings: 4,
    vars: {
      "piece-border-width": 1,
      "rings-opacity": 0.3,
    },
    colors: {
      primary: "#dbbd60",
      secondary: "#111012",
      ui: "#201f21",
      accent: "#2b2a2c",
      panel: "#97929ccc",
      board1: "#888888",
      board2: "#666666",
      board3: "#2b2a2c",
      player1: "#ffffff",
      player1road: "#cccccc",
      player1flat: "#cccccc",
      player1special: "#ffffff",
      player1border: "#302923",
      player2: "#445366",
      player2road: "#141f2e",
      player2flat: "#4f6178",
      player2special: "#415570",
      player2border: "#0f161f",
      ring1: "#000000ff",
      ring2: "#000000cc",
      ring3: "#302923cc",
      ring4: "#7a6c5dff",
      textLight: "#fafafa99",
      textDark: "#212121cd",
      umbra: "#00000066",
    },
  },
  {
    id: "paper",
    boardStyle: "grid1",
    boardChecker: false,
    vars: { "piece-border-width": 2 },
    colors: {
      primary: "#68c0e3",
      secondary: "#ffffff",
      ui: "#eeeeee",
      accent: "#cacaca",
      panel: "#8a8a8acc",
      board1: "#c8c8c8",
      board2: "#b8b8b8",
      board3: "#b8b8b8",
      player1: "#eeeeee",
      player1road: "#ffffff",
      player1flat: "#e8e8e8",
      player1special: "#ffffff",
      player1border: "#333333",
      player2: "#444444",
      player2road: "#606060",
      player2flat: "#606060",
      player2special: "#707070",
      player2border: "#000000",
      textLight: "#fafafacd",
      textDark: "#212121cd",
      umbra: "#00000022",
    },
  },
  {
    id: "retro",
    boardStyle: "grid1",
    boardChecker: false,
    vars: { "piece-border-width": 2 },
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
    boardStyle: "blank",
    boardChecker: true,
    rings: 0,
    vars: {
      "piece-border-width": 1,
      "rings-opacity": 0.25,
    },
    colors: {
      primary: "#800000",
      secondary: "#111111",
      ui: "#111111",
      accent: "#0d0d0d",
      panel: "#454545cc",
      board1: "#585858",
      board2: "#515151",
      board3: "#303030",
      player1: "#ababab",
      player1road: "#ababab",
      player1flat: "#a2a2a2",
      player1special: "#b3b3b3",
      player1border: "#262626",
      player2: "#000000",
      player2road: "#262626",
      player2flat: "#363636",
      player2special: "#1a1a1a",
      player2border: "#000000",
      ring1: "#ffffff44",
      ring2: "#ffffff88",
      ring3: "#ffffffcc",
      ring4: "#ffffffff",
      textLight: "#fafafa99",
      textDark: "#212121cd",
      umbra: "#00000066",
    },
  },
  {
    id: "terra",
    boardStyle: "grid3",
    boardChecker: true,
    rings: 0,
    vars: {
      "piece-border-width": 1,
      "rings-opacity": 0.2,
    },
    colors: {
      primary: "#edcc55",
      secondary: "#50628c",
      ui: "#5a6975",
      accent: "#4d5963",
      panel: "#6a7a9dcc",
      board1: "#95ad66",
      board2: "#88a356",
      board3: "#877863",
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
      ring1: "#00000099",
      ring2: "#00000033",
      ring3: "#ffffffaa",
      ring4: "#ffffffff",
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
      board1: "#decb9e",
      board2: "#d1bc8a",
      board3: "#d1bc8a",
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
