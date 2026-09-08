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
- Build-order stage 4: destructive image export. `core/redact.js` fills marked regions with
  opaque black at full raster resolution (never sampled from the scaled preview canvas);
  `export/exportImage.js` re-encodes to a PNG blob via `OffscreenCanvas` (falling back to a
  detached `<canvas>`); `export/download.js` triggers the browser download as
  `<source>-redacted.png`. The Header gains an accent-red Export button once a document is
  loaded — the one accent-red action outside the mark chrome itself.

  Hand-verified per SPEC.md's testing note: exported a PNG carrying a fabricated `tEXt`
  metadata chunk, with a mark covering a known region. In the exported bytes, the `tEXt` chunk
  and its content are completely absent; every sampled pixel inside the marked region reads as
  solid black; every sampled pixel outside it matches the source exactly. Verified
  programmatically (byte-scanning the export and reading back pixel values via canvas), not
  just by eye.
- Build-order stage 5: image metadata inspection. `inspect/imageMeta.js` reads the first
  256 KB of the source file and reports which metadata segments/chunks are present — JPEG APPn
  markers (EXIF, XMP, ICC, IPTC, comment), including walking the EXIF TIFF/IFD structure for a
  GPS pointer and an IFD1 thumbnail; PNG ancillary chunks (tEXt/zTXt/iTXt, eXIf, iCCP, tIME);
  WebP RIFF chunks (EXIF, XMP, ICCP). Presence only, never a value — the file is about to be
  shared. 19 new unit tests against hand-built marker/chunk byte arrays caught a real bug (an
  off-by-one in the XMP namespace-prefix length) before it shipped. `inspect/summary.js` merges
  mark counts and findings into the removal-summary model; `RemovalSummary` shows both,
  persistently, between the toolbar and the canvas.
