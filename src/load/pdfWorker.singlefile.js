// Single-file build's implementation of the `pdf-worker-setup` alias (see
// vite.config.singlefile.js) — build-order stage 10's flagged hazard. `vite-plugin-singlefile`
// only inlines files reachable via an HTML `<script src>`/`<link href>` tag; the pdf.js worker
// that `pdfWorker.js` loads via `new Worker(new URL(...))` is invisible to that and would
// survive the build as a second, separate multi-megabyte file sitting next to `blackout.html`
// — not "genuinely one file" at all, and one a real Worker couldn't load from a `file://` URL
// regardless (there's no same origin for it to be same-origin *to*).
//
// pdf.js has a documented main-thread fallback for exactly this situation: statically importing
// the worker bundle's `WorkerMessageHandler` and registering it as `globalThis.pdfjsWorker`
// makes `PDFWorker` skip trying to create a `Worker` at all (see the `#mainThreadWorkerMessageHandler`
// check in pdf.mjs's `PDFWorker#initialize`) and call the handler's code directly on the main
// thread through an in-memory `LoopbackPort` instead of `postMessage`. A static import means
// the worker bundle becomes part of the same JS chunk `vite-plugin-singlefile` already inlines
// — genuinely one file — at the cost of PDF parsing blocking the main thread rather than
// running off it. That trade, over building out a blob-worker path with its own CSP and
// module-resolution sharp edges, is this project's stage 10 decision — see SPEC.md.
let ready

export async function setupWorker() {
  if (!ready) {
    ready = import('pdfjs-dist/legacy/build/pdf.worker.min.mjs').then((pdfjsWorker) => {
      globalThis.pdfjsWorker = pdfjsWorker
    })
  }
  await ready
}
