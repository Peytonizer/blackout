import * as pdfjsLib from 'pdfjs-dist'

// The worker is bundled as a module worker rather than pdf.js's default (a classic worker
// pulled from a CDN or inlined as a blob), so it stays same-origin — the CSP's `script-src
// 'self'` covers it with no relaxation needed. Created lazily, once, on first use: a plain
// `import` of this module must not spin up a worker thread for someone who never opens a PDF.
let workerPort
function getWorkerPort() {
  if (!workerPort) {
    workerPort = new Worker(new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url), { type: 'module' })
  }
  return workerPort
}

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
 */
export function loadPdf(file, { dpi, onPasswordRequired } = {}) {
  return new Promise((resolve, reject) => {
    ;(async () => {
      try {
        pdfjsLib.GlobalWorkerOptions.workerPort = getWorkerPort()
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
          })
        }

        resolve({ pages })
      } catch (err) {
        reject(err)
      }
    })()
  })
}
