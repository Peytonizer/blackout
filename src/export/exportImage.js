import { renderPageBlob } from './renderPageBlob.js'

/**
 * Renders a redacted PNG blob from a page's raster and marks, at the raster's full resolution
 * — never the preview's scaled, possibly-smoothed canvas. Re-encoding through a fresh canvas
 * is what strips EXIF/XMP/IPTC/ICC and any embedded thumbnail from the source; metadata
 * removal is a consequence of this path, not a separate step that could be skipped.
 *
 * Image export is always PNG (SPEC.md's decisions table) — unlike a PDF page, there's no
 * codec choice here.
 */
export async function exportImage(raster, marks, width, height) {
  return renderPageBlob(raster, marks, width, height, { type: 'image/png' })
}
