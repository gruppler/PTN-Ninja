import { i18n } from "./boot/i18n";

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
    isDark: true,
    boardStyle: "checker",
    colors: {
      primary: "#8bc34a",
      secondary: "#607d8b",
      accent: "#202a2f",
      ui: "#263238",
      board1: "#8a9faa",
      board2: "#90a4ae",
      player1: "#cfd8dc",
      player2: "#263238",
    },
  },
  {
    id: "print",
    name: i18n.t("Print"),
    isDark: false,
    boardStyle: "grid",
    colors: {
      primary: "#ccc",
      secondary: "#fff",
      accent: "#ddd",
      ui: "#eee",
      board1: "#eee",
      board2: "#fff",
      player1: "#ddd",
      player2: "#333",
    },
  },
];
