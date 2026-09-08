import { renderRedacted } from '../core/redact.js'

/**
 * Renders a redacted PNG blob from a page's raster and marks, at the raster's full resolution
 * — never the preview's scaled, possibly-smoothed canvas. Re-encoding through a fresh canvas
 * is what strips EXIF/XMP/IPTC/ICC and any embedded thumbnail from the source; metadata
 * removal is a consequence of this path, not a separate step that could be skipped.
 *
 * Prefers `OffscreenCanvas` — off the main thread, no DOM attachment needed — and falls back
 * to a detached `<canvas>` element for a browser without it.
 */
export async function exportImage(raster, marks, width, height) {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height)
    renderRedacted(canvas.getContext('2d'), raster, marks, width, height)
    return canvas.convertToBlob({ type: 'image/png' })
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  renderRedacted(canvas.getContext('2d'), raster, marks, width, height)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode PNG'))), 'image/png')
  })
}
