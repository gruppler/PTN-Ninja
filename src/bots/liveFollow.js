// Pure helpers for following the main line of a live game. Kept free of
// store and bot references so the rules live in one place and the bot,
// its store watcher and the sweep all agree on what "the live frontier" is.

// Main-line ply IDs in order. For live PlayTak games the main line is
// capped to the server-synced count, so speculative spectator moves at the
// tip are never treated as a player's move. Returns null when there is
// nothing to follow: no plies, or fewer main-line plies than the cap.
export function getSyncedMainlinePlyIDs(plies, config) {
  if (!plies || !plies.length) return null;
  const syncedCap =
    config && config.playtakLive
      ? Math.max(0, parseInt(config.playtakSyncedMainline, 10) || 0)
      : Infinity;
  const ids = [];
  for (let i = 0; i < plies.length; i++) {
    const p = plies[i];
    if (p && !p.branch && p.text !== "--") {
      ids.push(p.id);
      if (ids.length >= syncedCap) break;
    }
  }
  if (syncedCap !== Infinity && ids.length < syncedCap) return null;
  return ids;
}

// The main-line plies a following lock still has to visit: everything after
// `anchorID` up to and including `endID`. One watcher callback can cover
// several plies (a reconnect burst), so this fills the gap rather than
// trusting that plies arrive one at a time.
export function getPlyIDsToQueue(mainlineIDs, anchorID, endID) {
  const endIndex = mainlineIDs.indexOf(endID);
  if (endIndex < 0) return [];
  const anchorIndex = anchorID == null ? -1 : mainlineIDs.indexOf(anchorID);
  if (anchorIndex < 0) return [endID];
  return mainlineIDs.slice(anchorIndex + 1, endIndex + 1);
}

// A following lock moves on when something is waiting and the current
// position is done with: it has had its minimum search, or the engine has
// stopped on its own and nothing more is coming for it.
export function shouldAdvanceLiveLock({
  queueLength,
  engineIdle,
  meetsMinimum,
}) {
  return queueLength > 0 && (engineIdle || meetsMinimum);
}
