import { GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'

// Hosted-build implementation of the `pdf-worker-setup` alias (see vite.config.js) — a real
// module worker, same-origin so the CSP's `script-src 'self'` covers it with no relaxation
// needed. Created lazily, once, on first use: importing this module must not spin up a worker
// thread for someone who never opens a PDF.
//
// vite.config.singlefile.js aliases the `pdf-worker-setup` specifier to
// `pdfWorker.singlefile.js` instead of this file — a real Worker needs a same-origin URL to
// load `pdf.worker.min.mjs` from, which a single `blackout.html` file opened via `file://`
// doesn't have one of.
let workerPort

export function setupWorker() {
  workerPort ??= new Worker(new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url), { type: 'module' })
  GlobalWorkerOptions.workerPort = workerPort
}
