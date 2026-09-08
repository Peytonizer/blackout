import { toDevicePixels } from './units.js'

/**
 * Draws `raster` onto `ctx` at full resolution, then destroys every marked region with an
 * opaque black fill. `marks` are normalised; `width`/`height` are the device-pixel dimensions
 * of `ctx` — always the page's *natural* size for export, never a scaled preview size, so the
 * fill lands on the pixels actually being destroyed rather than an approximation of them
 * (SPEC.md: never sample back from the preview canvas).
 */
export function renderRedacted(ctx, raster, marks, width, height) {
  ctx.drawImage(raster, 0, 0, width, height)
  ctx.fillStyle = '#000000'
  for (const m of marks) {
    const r = toDevicePixels(m, width, height)
    ctx.fillRect(r.x, r.y, r.w, r.h)
  }
}
