# Changelog

Notable changes to Blackout, newest first.

## Unreleased

- Project initiated: specification, build order and instructions written; repository
  scaffolded with its licence, ignore rules, README and changelog.
- Build-order stage 1: Vite + React + Tailwind + oxlint + vitest scaffold. CSP meta tag with
  `connect-src 'none'` and dark `color-scheme` in `index.html`; Signal theme tokens in
  `tailwind.config.js`, copied from the reconciled Scrubber config; self-hosted fonts; commit
  SHA stamped into the build via `vite.commit-sha.js`. Empty app shell with a header and
  footer, no document logic yet.
- Build-order stage 2: load and view a PNG/JPEG/WebP image. `Dropzone` accepts drag/drop, a
  file picker and clipboard paste, rejecting anything else with a message naming the accepted
  formats. `useDocument` holds the page/mark store (SPEC.md's core data model) with rasters
  kept out of React state in a ref-backed map. `PageCanvas` draws the raster fit-to-window with
  pan and zoom (toolbar buttons, or wheel — plain scroll pans, Ctrl/Cmd-scroll zooms toward the
  cursor), via a shared `usePageViewport` hook so a future `MarkLayer` can read the same
  transform.
- Build-order stage 3: mark rectangles. `core/marks.js`, `core/units.js` and `core/history.js`
  are pure, fully tested modules (44 unit tests) — normalised geometry (create, clamp, move,
  resize, hit-test) and a generic undo/redo snapshot stack. `MarkLayer` draws marks as opaque
  black rects with a 1px accent-red outline and, when selected, 8 accent-red resize handles
  (4 corners + 4 edge midpoints — SPEC.md's feature list and its Visual Design section
  disagreed on handle count; corner+edge was the deliberate call, see SPEC.md's decisions
  table). A left-drag now draws a mark rather than panning the canvas — stage 2's pointer-drag
  panning is superseded by this, the app's primary interaction; panning still works via the
  wheel. Delete (toolbar button or Delete/Backspace) removes the selected mark, Clear removes
  every mark on the page, both undoable.
