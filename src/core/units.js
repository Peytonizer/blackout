/**
 * Converts a normalised mark (0..1 against the page) into device pixels for the destructive
 * fill, rounding OUTWARD — floor the near edge, ceil the far edge — and clamping to the
 * canvas. Rounding inward, or to the nearest pixel, can leave a legible one-pixel sliver of
 * the original along an edge; on text at 300 DPI that sliver is a readable ascender row, so
 * this always errs towards destroying more. Both the export path (core/redact.js, build-order
 * stage 4) and anything needing pixel-accurate mark bounds use this — on-screen positioning
 * (MarkLayer) uses toScreenRect below instead, which is unrounded CSS-pixel chrome, not the
 * destructive geometry.
 */
export function toDevicePixels(mark, width, height) {
  const left = Math.max(0, Math.floor(mark.x * width))
  const top = Math.max(0, Math.floor(mark.y * height))
  const right = Math.min(width, Math.ceil((mark.x + mark.w) * width))
  const bottom = Math.min(height, Math.ceil((mark.y + mark.h) * height))
  return { x: left, y: top, w: Math.max(0, right - left), h: Math.max(0, bottom - top) }
}

/**
 * Converts a single normalised point (0..1 against the page) to on-screen CSS pixels, given
 * the page's natural size and the current pan/zoom viewport (usePageViewport) — the same
 * drawX/drawY/drawWidth/drawHeight PageCanvas computes to draw the raster itself, so anything
 * positioned with this lines up with the pixels it covers. Unrounded: this positions UI
 * chrome (mark rects, resize handles), not the destructive fill.
 */
export function toScreenPoint(point, naturalWidth, naturalHeight, containerSize, scale, offset) {
  const drawWidth = naturalWidth * scale
  const drawHeight = naturalHeight * scale
  const drawX = (containerSize.width - drawWidth) / 2 + offset.x
  const drawY = (containerSize.height - drawHeight) / 2 + offset.y
  return { x: drawX + point.x * drawWidth, y: drawY + point.y * drawHeight }
}

/** Where a normalised mark rect appears on screen — toScreenPoint for its origin, scaled for its size. */
export function toScreenRect(mark, naturalWidth, naturalHeight, containerSize, scale, offset) {
  const origin = toScreenPoint(mark, naturalWidth, naturalHeight, containerSize, scale, offset)
  return {
    x: origin.x,
    y: origin.y,
    w: mark.w * naturalWidth * scale,
    h: mark.h * naturalHeight * scale,
  }
}

/**
 * The inverse of toScreenPoint: an on-screen point (container-relative CSS pixels) to
 * normalised page coordinates. Used while dragging, since the pointer moves in screen space
 * but marks are stored normalised.
 */
export function toNormalizedPoint(point, naturalWidth, naturalHeight, containerSize, scale, offset) {
  const drawWidth = naturalWidth * scale
  const drawHeight = naturalHeight * scale
  const drawX = (containerSize.width - drawWidth) / 2 + offset.x
  const drawY = (containerSize.height - drawHeight) / 2 + offset.y
  return { x: (point.x - drawX) / drawWidth, y: (point.y - drawY) / drawHeight }
}
