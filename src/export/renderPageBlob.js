import { renderRedacted } from '../core/redact.js'

/**
 * Renders a page's raster and marks onto a full-resolution canvas via `core/redact.js`, then
 * encodes it to a blob. Shared by `exportImage.js` (always PNG) and `exportPdf.js` (JPEG by
 * default, PNG when the lossless toggle is on), so both draw from the same canvas-creation and
 * `OffscreenCanvas`-fallback logic rather than duplicating it.
 *
 * Prefers `OffscreenCanvas` — off the main thread, no DOM attachment needed — and falls back to
 * a detached `<canvas>` element for a browser without it.
 */
export async function renderPageBlob(raster, marks, width, height, { type = 'image/png', quality } = {}) {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height)
    renderRedacted(canvas.getContext('2d'), raster, marks, width, height)
    return canvas.convertToBlob({ type, quality })
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  renderRedacted(canvas.getContext('2d'), raster, marks, width, height)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode image'))), type, quality)
  })
}
