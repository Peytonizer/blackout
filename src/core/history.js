/**
 * A generic undo/redo stack of snapshots — used here over a page's mark list, but these
 * functions don't know or care what a snapshot contains. Every meaningful action (create,
 * move, resize, delete, clear) commits one new snapshot; undo/redo step through them linearly.
 * A commit made after an undo drops the redo branch entirely — the conventional behaviour, and
 * the only kind SPEC.md calls for. ("No undo after export" is about the export boundary, not
 * this stack, which never sees export at all.)
 */
export function createHistory(initial) {
  return { past: [], present: initial, future: [] }
}

export function commit(history, next) {
  return { past: [...history.past, history.present], present: next, future: [] }
}

export function undo(history) {
  if (history.past.length === 0) return history
  const previous = history.past[history.past.length - 1]
  return { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] }
}

export function redo(history) {
  if (history.future.length === 0) return history
  const [next, ...rest] = history.future
  return { past: [...history.past, history.present], present: next, future: rest }
}

export function canUndo(history) {
  return history.past.length > 0
}

export function canRedo(history) {
  return history.future.length > 0
}
