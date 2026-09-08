/**
 * The eight resize handles a selected mark shows: four corners plus four edge midpoints. A
 * corner handle changes both dimensions; an edge handle changes only the one it sits on
 * (SPEC.md feature 3: "resize by corner/edge handles").
 */
export const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

// A mark this small (roughly 4px on a 1000px-wide page) is treated as an accidental
// click-with-no-drag rather than a real mark — see isDegenerate.
const MIN_SIZE = 0.004

const clamp01 = (v) => Math.min(1, Math.max(0, v))

/**
 * Turns two arbitrary corners into a normalised, top-left-origin rect with positive width and
 * height. A drag that goes up and to the left (or a resize handle dragged past the opposite
 * edge) produces a "negative" rectangle if you don't do this — normalising here means no
 * consumer downstream ever has to handle one.
 */
export function normalizeRect(x1, y1, x2, y2) {
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) }
}

/**
 * Clamps a rect's edges independently to the 0..1 page. Used after a resize: because only the
 * edge(s) a handle touches move, clamping each edge on its own is exactly "a handle dragged
 * past the page edge stops at the edge" — the far, undragged edge is already in bounds and
 * clamping leaves it untouched.
 */
export function clampRect({ x, y, w, h }) {
  const left = clamp01(x)
  const top = clamp01(y)
  const right = clamp01(x + w)
  const bottom = clamp01(y + h)
  return { x: left, y: top, w: Math.max(0, right - left), h: Math.max(0, bottom - top) }
}

/**
 * Clamps a rect's position, not its size, so it stays entirely inside the 0..1 page — used
 * after moving a mark by dragging its body. Unlike clampRect this never shrinks the mark, it
 * only stops it at the edge: resizing is the only gesture allowed to change a mark's size.
 */
export function clampPosition({ x, y, w, h }) {
  return { x: Math.min(Math.max(x, 0), Math.max(0, 1 - w)), y: Math.min(Math.max(y, 0), Math.max(0, 1 - h)), w, h }
}

/** Translates a rect by a normalised delta, preserving its size. Pair with clampPosition after. */
export function moveRect(rect, dx, dy) {
  return { x: rect.x + dx, y: rect.y + dy, w: rect.w, h: rect.h }
}

/**
 * Applies a drag delta to one handle of a rect and re-normalises. A handle's name says which
 * edge(s) it moves — 'nw' moves the left and top edges, 'e' moves only the right edge — so a
 * handle dragged past the opposite edge flips the rect rather than going negative, the same
 * rule normalizeRect enforces at creation. Pair with clampRect after, so a handle dragged past
 * the page edge stops there instead of extending the mark off-page.
 */
export function resizeRect(rect, handle, dx, dy) {
  let x1 = rect.x
  let y1 = rect.y
  let x2 = rect.x + rect.w
  let y2 = rect.y + rect.h
  if (handle.includes('w')) x1 += dx
  if (handle.includes('e')) x2 += dx
  if (handle.includes('n')) y1 += dy
  if (handle.includes('s')) y2 += dy
  return normalizeRect(x1, y1, x2, y2)
}

/** The normalised position of one handle on a rect — the midpoint of the edge(s) it resizes. */
export function handlePoint(rect, handle) {
  const x = handle.includes('w') ? rect.x : handle.includes('e') ? rect.x + rect.w : rect.x + rect.w / 2
  const y = handle.includes('n') ? rect.y : handle.includes('s') ? rect.y + rect.h : rect.y + rect.h / 2
  return { x, y }
}

/**
 * Whether a normalised point falls inside a rect, edges inclusive, and the topmost (last-
 * drawn) mark under a point when several overlap. Exposed for completeness — SPEC.md's
 * proposed layout names hit-testing as a marks.js concern — but MarkLayer's DOM-based overlay
 * relies on native element targeting instead, which handles overlap and z-order for free.
 */
export function hitTestRect(rect, point) {
  return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h
}

export function hitTestMarks(marks, point) {
  for (let i = marks.length - 1; i >= 0; i--) {
    if (hitTestRect(marks[i], point)) return marks[i]
  }
  return null
}

/** Whether a rect is too small to keep — discards an accidental click-with-no-drag. */
export function isDegenerate(rect) {
  return rect.w < MIN_SIZE || rect.h < MIN_SIZE
}
