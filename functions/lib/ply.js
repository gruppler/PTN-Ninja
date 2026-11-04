// Strict PTN ply grammar for moves sent to the server.
//
// Keep in step with the client's parser, src/Game/PTN/ptn.js and
// src/Game/PTN/Ply.js (Ply.test / Ply#toString(true)): every ply the server
// stores must be the canonical text the client renders for that ply, so the
// client can parse it back to the same move. The client's grammar is
//   [count][C|S]<column><row>[<direction>[drops][*]]
// with optional trailing evaluation marks, which it never sends.

const MAX_PLY_LENGTH = 20;

// Anchored: the whole (trimmed) input must be one ply
const PLY_GRAMMAR =
  /^([1-8])?([CS])?([a-h])([1-8])(?:([<>+-])([1-8]*)(\*)?)?([?!'"]*)$/i;

class PlyError extends Error {}

// Parse a ply's text, or throw a PlyError. Returns its parts and its
// canonical text (without the wall-smash mark, which depends on the board).
function parsePly(text) {
  if (typeof text !== "string") {
    throw new PlyError("Invalid ply");
  }
  text = text.trim();
  if (!text || text.length > MAX_PLY_LENGTH) {
    throw new PlyError("Invalid ply");
  }
  const match = text.match(PLY_GRAMMAR);
  if (!match) {
    throw new PlyError("Invalid ply");
  }
  const [, count, special, column, row, direction, drops, smash] = match;
  const square = column.toLowerCase() + row;
  const specialPiece = special ? special.toUpperCase() : "";

  if (!direction) {
    // Placement
    if (count) {
      throw new PlyError("Invalid ply: a placement has no count");
    }
    return {
      isMovement: false,
      specialPiece,
      square,
      canonical: specialPiece + square,
    };
  }

  // Movement
  if (specialPiece) {
    throw new PlyError("Invalid ply: a move has no stone type");
  }
  const pieceCount = Number(count || 1);
  const distribution = drops || String(pieceCount);
  const total = distribution
    .split("")
    .reduce((sum, drop) => sum + Number(drop), 0);
  if (total !== pieceCount) {
    throw new PlyError("Invalid ply: drops don't add up to the count");
  }
  return {
    isMovement: true,
    pieceCount,
    distribution,
    direction,
    square,
    hasSmashMark: !!smash,
    // As the client renders it: no count of 1, no drops when they're all
    // dropped on one square
    canonical:
      (pieceCount === 1 ? "" : String(pieceCount)) +
      square +
      direction +
      (distribution === String(pieceCount) ? "" : distribution),
  };
}

module.exports = { MAX_PLY_LENGTH, PLY_GRAMMAR, PlyError, parsePly };
