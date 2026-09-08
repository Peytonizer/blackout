// pdfjs-dist's "legacy" build, not its modern default — the modern build assumes the runtime
// already has very recent JS built-ins (e.g. Math.sumPrecise, used in its font and XFA-layout
// code) and crashes outright on a browser without them yet, which was still true of a current
// Chrome release when this was written. The legacy build carries a small core-js polyfill for
// exactly that gap, at negligible extra size, and is the deliberately safer choice for a
// public tool whose users aren't all on the bleeding edge of browser feature rollout.
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import { pdfMeta } from '../inspect/pdfMeta.js'
// Resolves to a real module worker in the hosted build and a main-thread fallback in the
// single-file build — see vite.config.js / vite.config.singlefile.js and
// src/load/pdfWorker(.singlefile).js for why (build-order stage 10).
import { setupWorker } from 'pdf-worker-setup'

/**
 * Opens `file` with pdf.js and renders every page to an `ImageBitmap` at `dpi`, the same raster
 * shape `load/loadImage.js` produces for a plain image — everything downstream (PageCanvas,
 * MarkLayer, core/redact.js) stays format-agnostic because of that.
 *
 * `onPasswordRequired({ incorrect, attempt })` is called for a password-protected file and
 * must resolve to the entered password, or `null`/`undefined` to give up. Not supplying one
 * (or a password-protected file arriving with none given) fails fast rather than hanging.
 *
 * Each page records `pdfPointSize` from `page.getViewport({ scale: 1 })` — the page box in PDF
 * points, taken from the *same rotated viewport* used to render, so a rotated source page
 * (`/Rotate`) ends up upright in both the raster and the point size. Getting this wrong
 * produces a landscape page rendered into a portrait box.
 *
 * Also returns `metadataFindings` and `attachmentCount` (via `inspect/pdfMeta.js`, read off
 * the same open document before rendering starts), and folds each page's annotation/form-field
 * counts and text-layer presence into that page's own returned object.
 */
export function loadPdf(file, { dpi, onPasswordRequired } = {}) {
  return new Promise((resolve, reject) => {
    ;(async () => {
      try {
        await setupWorker()
        const data = await file.arrayBuffer()
        const loadingTask = pdfjsLib.getDocument({ data })

        let attempts = 0
        loadingTask.onPassword = (updatePassword, reason) => {
          attempts += 1
          if (!onPasswordRequired) {
            loadingTask.destroy()
            reject(new Error('This PDF is password-protected.'))
            return
          }
          if (attempts > 3) {
            loadingTask.destroy()
            reject(new Error('Incorrect password — giving up after 3 attempts.'))
            return
          }
          const incorrect = reason === pdfjsLib.PasswordResponses.INCORRECT_PASSWORD
          Promise.resolve(onPasswordRequired({ incorrect, attempt: attempts })).then((password) => {
            if (password == null) {
              loadingTask.destroy()
              reject(new Error('Password entry cancelled.'))
              return
            }
            updatePassword(password)
          })
        }

        const pdf = await loadingTask.promise
        // Read before rendering: getMetadata/getAttachments/getAnnotations/getTextContent are
        // cheap compared to rendering, and reading them off the same open document rather than
        // opening the file a second time is what avoids prompting for the password twice.
        const { findings: metadataFindings, attachmentCount, pages: pageMeta } = await pdfMeta(pdf)

        const pages = []
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          // getViewport already applies /Rotate, so both the raster and pdfPointSize below
          // agree on "upright" — reading the point size from the unrotated MediaBox instead
          // would silently swap width/height on a rotated page.
          const viewport = page.getViewport({ scale: dpi / 72 })
          const pointViewport = page.getViewport({ scale: 1 })

          const width = Math.ceil(viewport.width)
          const height = Math.ceil(viewport.height)
          const canvas = new OffscreenCanvas(width, height)
          const ctx = canvas.getContext('2d')
          await page.render({ canvasContext: ctx, viewport }).promise
          const bitmap = await createImageBitmap(canvas)

          pages.push({
            bitmap,
            width: bitmap.width,
            height: bitmap.height,
            pdfPointSize: { width: pointViewport.width, height: pointViewport.height },
            ...pageMeta[i - 1],
          })
        }

        resolve({ pages, metadataFindings, attachmentCount })
      } catch (err) {
        reject(err)
      }
    })()
  })
}
