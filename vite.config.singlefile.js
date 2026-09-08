import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { getCommitSha } from './vite.commit-sha.js'

/**
 * Second build target (SPEC.md build order, stage 10): produces `dist-single/blackout.html`, a
 * single self-contained file that runs from a `file://` URL with no server — download it once,
 * disconnect, and it still works.
 *
 * Same React plugin and the same `index.html`/Tailwind pipeline as the hosted build
 * (`vite.config.js`); `viteSingleFile`'s recommended config (on by default) inlines the built
 * CSS and JS as a `<style>`/`<script>` tag. The plugins below handle what's left over: the CSP
 * needs relaxing for the now-inline script to run, the pdf.js worker needs a build actually
 * capable of running without a same-origin URL to load a Worker from (see the `pdf-worker-setup`
 * alias below and `src/load/pdfWorker.singlefile.js` — build-order stage 10's flagged hazard),
 * and the favicon is a `public/` file `vite-plugin-singlefile` doesn't inline, so it's the one
 * remaining external reference this build would otherwise carry.
 */

/** An inlined `<script>` needs `'unsafe-inline'` in `script-src` to run — `'self'` only covers
 * a same-origin *external* file, which an inlined script no longer is. `style-src` already
 * carries `'unsafe-inline'` (added in stage 1, for Vite's dev-mode CSS injection).
 *
 * `font-src` gets `data:` added the same way `img-src` already allows it, because the
 * self-hosted fonts end up inlined as `data:` URIs inside the (now inline) CSS's `@font-face`
 * rules once `cssCodeSplit` is off — `font-src 'self'` alone does not cover a `data:` source.
 *
 * Nothing here touches `worker-src`: `pdfWorker.singlefile.js` never creates a real `Worker`,
 * so there's no worker source to widen for — see that file for why.
 * `connect-src 'none'` — the part of the CSP that actually enforces the privacy guarantee — is
 * untouched by any of this.
 */
function relaxCspForSingleFile() {
  return {
    name: 'relax-csp-for-single-file',
    transformIndexHtml(html) {
      return html
        .replace("script-src 'self';", "script-src 'self' 'unsafe-inline';")
        .replace("font-src 'self';", "font-src 'self' data:;")
    },
  }
}

/** Replaces the `<link rel="icon">`'s `href="/favicon.svg"` with the file's own content as a
 * data URI, so the single-file build has no dependency on a `public/` file existing alongside
 * it — genuinely one file, nothing else to lose. */
function inlineFavicon() {
  return {
    name: 'inline-favicon',
    transformIndexHtml(html) {
      const svg = readFileSync(new URL('./public/favicon.svg', import.meta.url), 'utf8')
      const dataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
      return html.replace('/favicon.svg', dataUri)
    },
  }
}

export default defineConfig({
  plugins: [react(), relaxCspForSingleFile(), inlineFavicon(), viteSingleFile()],
  // Swaps in the main-thread pdf.js worker setup in place of the hosted build's real-Worker
  // one — see src/load/pdfWorker.singlefile.js and the module comment above. Aliasing the
  // specifier (rather than branching inside one file on a define'd flag) guarantees the real
  // build's `new Worker(new URL(...))` call never appears in this build's module graph at all,
  // so Vite's worker-chunk detection — which scans source text, not reachability — can't emit
  // it as a second file no matter what dead-code elimination does or doesn't manage.
  resolve: {
    alias: {
      'pdf-worker-setup': fileURLToPath(new URL('./src/load/pdfWorker.singlefile.js', import.meta.url)),
    },
  },
  // The favicon is inlined as a data URI above, and nothing else references a public/ file, so
  // there is nothing left to copy — `publicDir: false` keeps this build to genuinely one file.
  publicDir: false,
  // Stamps the build's commit SHA into the footer link — see vite.commit-sha.js. A single-file
  // build is typically built locally from a checkout rather than in CI, so this is the same
  // "read the SHA from whatever commit is currently checked out" logic as the normal build.
  define: {
    'import.meta.env.VITE_COMMIT_SHA': JSON.stringify(getCommitSha()),
  },
  build: {
    outDir: 'dist-single',
  },
})
