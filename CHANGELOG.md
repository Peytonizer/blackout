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
- Build-order stage 6 (render path): load and view an unencrypted PDF. `load/loadPdf.js`
  renders every page via `pdfjs-dist`, at a chosen DPI (96/150/300, default 150 — SPEC.md's
  decisions table) picked once before loading, since a PDF page has no natural pixel size the
  way an image does; that rendered raster then flows through the exact same preview/marks
  pipeline images already use. The worker is bundled as a same-origin module worker
  (`pdf.worker.min.mjs`), created lazily on first use, and `pdfjs-dist` itself is only fetched
  when a PDF is actually opened (dynamic import) rather than growing the bundle for
  image-only use. Each page's `pdfPointSize` is read from the same rotated viewport used to
  render, so a rotated source page ends up upright in both.

  `useDocument` now keeps one undo/redo history per page, keyed by page id, rather than
  assuming a single page — `PageStrip` shows a thumbnail and mark count per page and switches
  which one is being viewed/marked; `RemovalSummary`'s mark count is a document-wide total
  across every page. Export stays hidden for a PDF until real PDF export exists (stage 8) —
  `exportImage` only knows how to encode a single page as a PNG.

  Password-protected PDFs fail fast with a clear message for now; the interactive prompt is
  the second half of this stage, following SPEC.md's own sequencing note ("land the render
  path first and commit, then the password path").

  Verified in a real browser with a hand-built two-page PDF: pages render correctly, marks on
  one page don't leak onto another and survive switching back, and re-loading at 300 DPI
  produces a raster exactly double the size of the 150 DPI default (72% fit vs 144%).
- Build-order stage 6 (password path): the interactive password prompt for an encrypted PDF.
  `PdfPasswordPrompt` shows a form while `load/loadPdf.js`'s `onPassword` callback waits on it;
  submitting or cancelling resolves that wait, letting pdf.js's loading task continue or give
  up. Three wrong attempts fail with a clear message, matching SPEC.md's decision to accept
  encrypted PDFs rather than reject them outright.

  Found and fixed while testing this against a real encrypted PDF: pdf.js's default ("modern")
  build calls `Math.sumPrecise` — a JS built-in this session's current Chrome release doesn't
  have yet — in its font and XFA-layout code, and crashes outright the moment that code path
  runs (which a real password-protected file's processing reliably hit). Switched to
  `pdfjs-dist/legacy/build`, which carries a small core-js polyfill for exactly this gap, at a
  modest bundle-size cost. The deliberately safer choice for a public tool whose users aren't
  all on the bleeding edge of browser feature rollout.

  Verified in a real browser end to end: the prompt appears for an encrypted PDF built with a
  real password; a wrong password shows "attempt N of 3" and lets you retry; the correct
  password unlocks and renders the page; Cancel gives a clear message and returns to the empty
  state; three wrong attempts in a row gives up with its own clear message, never hanging.
- Build-order stage 7: PDF metadata inspection. `inspect/pdfMeta.js` reads, from the same open
  pdf.js document `load/loadPdf.js` already has (no second open, no second password prompt):
  which Info dictionary fields are present and whether an XMP packet exists, the attachment
  count, and per page the annotation count, how many of those are form fields (Widget
  annotations, which pdf.js marks with a `fieldType`), and whether a text layer exists —
  explaining why the export loses selectable text. `inspect/summary.js` and `RemovalSummary`
  fold these in alongside the image-only fields from stage 5, only rendering a field when it's
  actually present so a document with none of them stays uncluttered. 11 new unit tests cover
  the pure summarising functions.

  Verified in a real browser with a hand-built PDF carrying Info dictionary fields, a text
  annotation, a form-field widget and real selectable text: every one of those is correctly
  named and counted, including the singular/plural wording. One field could not be verified as
  working: `pdf.getAttachments()` returns nothing for an embedded file, confirmed against both
  a pikepdf-generated attachment and a hand-built one matching pdf.js's own parsing source
  exactly — a limitation in this pdfjs-dist version's own code, not this app's. Documented in
  `inspect/pdfMeta.js`. Doesn't affect the guarantee: attachments are still destroyed on
  export regardless of whether this one count detects them, since `export/exportPdf.js`
  (stage 8) never carries a source object across at all.
