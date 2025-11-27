

/**************************************************************************
 * undoManager.js
 * ----------------
 * Shared in memory undo manager for all solitaire games.
 *
 * Design decisions:
 * - Pure in memory: no localStorage, no server calls.
 * - Game agnostic: it stores opaque "snapshots". It does not know about cards or piles.
 * - One logical move = one snapshot. Undo always goes back exactly one move.
 *
 * How games are expected to use this:
 *
 * 1) A game owns a single `gameState` object that represents everything that
 *    matters for undo:
 *    - piles and cards
 *    - score and move counters
 *    - timer state if you want it to be undoable
 *    - any other flags that affect rendering
 *
 * 2) Before applying a logical move, the game calls `UndoManager.pushSnapshot`
 *    with the current `gameState`:
 *
 *        UndoManager.pushSnapshot(gameState);
 *        applyMove(gameState, move);
 *        renderFromState(gameState);
 *
 *    The snapshot is taken before the move, so Undo can go back to that state.
 *
 * 3) When the user presses the Undo button, the game calls `UndoManager.undo()`:
 *
 *        const previous = UndoManager.undo();
 *        if (previous) {
 *          gameState = previous;
 *          renderFromState(gameState);
 *        }
 *
 *    If there is no previous state, `undo()` returns `null` and the game should
 *    do nothing or keep the Undo button disabled.
 *
 * 4) When starting a completely new deal or changing game mode, the game calls
 *    `UndoManager.reset()` to clear old history.
 *
 * Notes about cloning:
 * - We store a deep copy of the state so future mutations do not affect history.
 * - We try to use `structuredClone` where available because it is fast and
 *   preserves object graphs more accurately.
 * - As a fallback, we use JSON serialization, which works for plain data
 *   structures (numbers, strings, arrays, plain objects) - which is exactly
 *   what your `gameState` should contain.
 **************************************************************************/

// IIFE (Immediately Invoked Function Expression) used to keep internal
// variables private while exposing a small public API.
const UndoManager = (function () {

  // Internal array used as a stack:
  // - index 0 = oldest snapshot
  // - index history.length - 1 = most recent snapshot

  let history = [];

  // Safety cap for history length.
  // Solitaire states are small, but we still keep an upper bound.
  // If you want unlimited history, set this to `Infinity` in init.
  let maxHistory = 500;

   /**************************************************************************
   * Deep clone helper.
   *
   * You should only pass plain data objects here - no functions, DOM nodes,
   * class instances, or circular references.
   *
   * If `structuredClone` exists, prefer that. Otherwise, fall back to
   * JSON.stringify / JSON.parse which works well for simple data.
   **************************************************************************/
  function cloneState(snapshot) {
    if (snapshot == null) {
      return snapshot;
    }

    // Modern browsers: use structuredClone when available.
    if (typeof structuredClone === "function") {
      return structuredClone(snapshot);
    }

    // Fallback: JSON based deep copy.
    // Assumption: `snapshot` is JSON safe.
    return JSON.parse(JSON.stringify(snapshot));
  }

   /**************************************************************************
   * Reset the entire undo history.
   *
   * Call this when:
   * - starting a brand new game or deal
   * - changing game variant or rules in a way that invalidates old history
   **************************************************************************/
  function reset() {
    history = [];
  }

   /**************************************************************************
   * Optional: configure the maximum number of snapshots to keep.
   *
   * For solitaire, you can usually keep a fairly high number. The default is
   * 500 which should be safe. If you see memory issues on very old devices,
   * you can lower it.
   **************************************************************************/
  function setMaxHistory(limit) {
    if (typeof limit === "number" && limit > 0) {
      maxHistory = limit;

      // If the new limit is lower than the current size, trim from the front
      // (oldest states are discarded first).
      if (history.length > maxHistory) {
        history = history.slice(history.length - maxHistory);
      }
    }
  }

   /**************************************************************************
   * Push a snapshot of the current game state onto the history stack.
   *
   * Important:
   * - Call this BEFORE applying a move so Undo returns the "before" state.
   * - `snapshot` should be the full gameState object, not just a part.
   **************************************************************************/
  function pushSnapshot(snapshot) {
    if (snapshot == null) {
      // Nothing to push. Silent no-op by design to keep call sites simple.
      return;
    }

    // Always store a deep clone to decouple history from future mutations.
    const cloned = cloneState(snapshot);

    history.push(cloned);

    // Enforce history length cap by dropping the oldest entries first.
    if (history.length > maxHistory) {
      const overflow = history.length - maxHistory;
      history.splice(0, overflow);
    }
  }

   /**************************************************************************
   * Returns true if there is at least one previous state to undo to.
   *
   * Use this to enable or disable the Undo button in the UI.
   **************************************************************************/
  function canUndo() {
    return history.length > 0;
  }

   /**************************************************************************
   * Pop and return the most recent snapshot from history.
   *
   * The caller is responsible for:
   * - treating the returned value as the new gameState
   * - re rendering the game from that state
   *
   * If there is no history, returns null.
   **************************************************************************/
  function undo() {
    if (!canUndo()) {
      return null;
    }

    // Last snapshot in the array represents the state before the last move.
    return history.pop();
  }

   /**************************************************************************
   * Optional helper primarily for debugging or analytics.
   *
   * You can ignore this in production game logic if you do not need it.
   **************************************************************************/
  function getHistorySize() {
    return history.length;
  }

  // Public API exposed to game scripts.
  return {
    reset,
    setMaxHistory,
    pushSnapshot,
    canUndo,
    undo,
    getHistorySize,
  };
})();

// If you use ES modules and a bundler, you can also export it.
// Comment this out if you prefer to access UndoManager via the global object.
export default UndoManager;