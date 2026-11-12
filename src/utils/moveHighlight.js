// The last move is shown on the board by its squares or by its pieces, or not
// at all. It's stored as two flags, highlightSquares and highlightPieces,
// which older settings, embeds and image configs already carry; outlining the
// pieces takes the place of highlighting the squares.

export const MOVE_HIGHLIGHTS = ["squares", "pieces", "none"];

// Options for a select, labeled with i18n keys
export const MOVE_HIGHLIGHT_OPTIONS = [
  { label: "Squares", value: "squares" },
  { label: "Pieces", value: "pieces" },
  { label: "None", value: "none" },
];

export const getMoveHighlight = ({ highlightPieces, highlightSquares }) =>
  highlightPieces ? "pieces" : highlightSquares ? "squares" : "none";

export const moveHighlightFlags = (value) => ({
  highlightPieces: value === "pieces",
  highlightSquares: value === "squares",
});
