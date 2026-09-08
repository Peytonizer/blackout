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
- Build-order stage 8: PDF export. `export/exportPdf.js` rebuilds a redacted PDF from scratch
  via pdf-lib — a brand-new `PDFDocument` that never opens or copies anything from the source,
  the guarantee for PDFs. Each page is redacted at full raster resolution (`core/redact.js`,
  via a new shared `export/renderPageBlob.js` — factored out of `exportImage.js`, which now
  delegates to it, so both share the exact same canvas-creation logic rather than duplicating
  it) and embedded on a page sized to the *original* PDF's point size, so the output prints at
  the source's physical size regardless of render DPI. `codec` is JPEG at quality 0.92 by
  default, with a lossless-PNG toggle next to Export in the Header, shown only for a PDF
  (SPEC.md's decisions table). All Info dictionary fields are cleared and both dates set to
  the Unix epoch. `pdf-lib` is dynamically imported, alongside `pdfjs-dist`, so neither reaches
  someone who only ever handles images.

  Verified as far as this session's browser environment allowed: exporting a redacted 2-page
  PDF and re-opening it confirmed, programmatically, that both pages survive, every Info field
  is empty, and both dates read the 1970 epoch — an exact match for SPEC.md's decision table.
  Full pixel-level re-render of the *exported* file specifically could not be completed:
  `page.render()` began hanging late in this session for every PDF, including the known-good
  source file this same session had rendered correctly many times over — reproduced with a
  fresh dev server and fresh browser tabs, ruling out server/cache staleness, and traced with
  `getDocument`/`getMetadata`/`getAnnotations`/`getTextContent` all succeeding promptly while
  only `render()` stalled. Read as browser resource exhaustion after a very long, worker-heavy
  session, not a code defect — the redaction pixel logic this export reuses unchanged
  (`core/redact.js`, via the same `renderPageBlob` path) was already verified byte-for-byte at
  stage 4, and is exercised identically here.
- Build-order stage 9: the export contract. `ExportPanel` states, plainly, before a PDF export
  runs: the file is rebuilt as images and grows, selectable text is lost (only shown when the
  source actually has a text layer to lose), an encrypted source's exported copy won't be
  (only shown when the source needed a password), and there's no undo — matching SPEC.md's
  decisions table exactly. Requires a deliberate "Export anyway" click before the irreversible
  export runs. An image export has none of these costs (same pixels, PNG out, nothing lost) and
  proceeds directly, exactly as it always has — the panel never appears for one. README already
  described this contract accurately (written aspirationally at stage 1); reviewed, no changes
  needed.

  Verified in a real browser: an image export produces a valid PNG with no panel shown, exactly
  as before. The PDF path (panel content, confirm/cancel) could not be exercised live —
  `page.render()` remained hung for the rest of this session, the same browser-environment
  issue noted at stage 8, confirmed still present after closing tabs and a dev-server restart.
  `ExportPanel` follows the identical modal pattern `PdfPasswordPrompt` already uses
  successfully (stage 6), and its logic is plain conditional rendering off already-verified
  `doc.inspection.hasTextLayer` and `wasEncrypted` values.
- Verified in a fresh browser session (after a machine reboot) what stages 8 and 9 couldn't
  finish live: `page.render()` no longer hangs, confirming that was browser resource
  exhaustion as suspected, not a code defect. A fabricated 2-page PDF, marked and exported
  through the real UI, came back with both pages intact, the redacted region genuinely
  destroyed, and every Info field cleared — `Producer` empty and both dates at the epoch,
  matching SPEC.md's decisions table exactly. (An initial read of the export appeared to show
  `Producer` and `ModDate` uncleared; that was a false alarm from the verification script
  itself — `PDFDocument.load()` without `{ updateMetadata: false }` re-stamps those fields on
  the in-memory copy the moment it's loaded, so inspecting an export needs that option too.
  The export code was already correct.)
- Build-order stage 10: the single-file build. `vite.config.singlefile.js` produces
  `dist-single/blackout.html` via `vite-plugin-singlefile`, with `relaxCspForSingleFile`
  adding `'unsafe-inline'` to `script-src` (the bundle is now an inline `<script>`, not a
  same-origin file) and `data:` to `font-src` (the self-hosted fonts end up inlined as
  `data:` `@font-face` URIs once CSS code-splitting is off), and `inlineFavicon` embedding
  `public/favicon.svg` as a data URI so the build has no dependency on a `public/` file.
  `connect-src 'none'` is untouched.

  Resolves the hazard flagged when this stage was planned: `vite-plugin-singlefile` only
  inlines files an HTML tag points at, and the pdf.js worker is loaded at runtime via
  `new Worker(new URL(...))` — invisible to that — so left alone it survived the build as a
  second, ~1.2MB file next to `blackout.html`, which a real `Worker` couldn't have loaded from
  `file://` anyway (no origin to be same-origin *to*). `src/load/pdfWorker.singlefile.js`
  statically imports the worker bundle's `WorkerMessageHandler` and registers it as
  `globalThis.pdfjsWorker`, which makes pdf.js skip creating a `Worker` entirely and run the
  handler on the main thread instead (pdf.js's own documented fallback, deliberately
  triggered) — genuinely one file, at the cost of PDF parsing blocking the tab in this build
  only. `src/load/pdfWorker.js` (the hosted build's real-`Worker` implementation) and its
  `.singlefile.js` counterpart are swapped via a `pdf-worker-setup` resolve alias, one per
  config, so the real-`Worker` code never appears in the single-file build's module graph at
  all — no reliance on dead-code elimination to keep it out. No CSP change was needed for the
  worker specifically. Recorded in SPEC.md's decisions table.

  Verified in a real browser (served over `localhost` via `vite preview`, since this
  extension's browser automation can't drive a `file://` tab directly): a fabricated 2-page
  PDF loaded, rendered and exported correctly, console showing pdf.js's own "Setting up fake
  worker" message and no errors — confirming the fallback path runs and produces the same
  correct output (2 pages, metadata cleared, no leaked text) as the hosted build's real-worker
  path.
- Build-order stage 11: deploy. `.github/workflows/deploy.yml` (copied from Scrubber's, same
  shape) builds on every push to `main` via `actions/deploy-pages` — checkout, `npm ci`,
  `npm test`, both builds, `CNAME` and `dist-single/blackout.html` copied into `dist` before
  upload, so the single-file build is downloadable straight from the live site at
  `blackout.noradz.io/blackout.html`. Test failure blocks the deploy; only one Pages
  deployment runs at a time, a newer push winning rather than queuing. Repo's Pages source set
  to "GitHub Actions" via the API to match. From this commit, a push to `main` is a deploy.
  The `blackout.noradz.io` DNS record is outside this repo and wasn't set up in this session.
