import { useEffect, useRef } from 'react'
import { ZOOM_STEP } from '../state/usePageViewport.js'

// A physical mouse's scroll wheel reports one notch as a single wheel event with a large
// deltaY (commonly ~100) — very different from a trackpad pinch, which fires many events with
// small deltaY as it tracks finger movement continuously. `zoomAt`'s factor is
// `Math.exp(-deltaY * WHEEL_ZOOM_RATE)`, so calibrating that rate against a 100-unit deltaY
// landing on exactly `ZOOM_STEP` makes one wheel notch feel like one Toolbar zoom-button click,
// rather than the much larger jump a small rate constant (tuned for smooth trackpad deltas)
// produces on a single big notch.
const WHEEL_NOTCH_DELTA = 100
const WHEEL_ZOOM_RATE = Math.log(ZOOM_STEP) / WHEEL_NOTCH_DELTA

/**
 * Draws the page raster into a canvas sized to the container, transformed by the shared
 * viewport (`usePageViewport`): centred, then scaled and offset. The wheel zooms toward the
 * cursor when Ctrl/Cmd is held (a trackpad pinch reports as a ctrl+wheel event) and pans
 * otherwise.
 *
 * Stage 2's pointer-drag panning is gone: `children` (MarkLayer, from build-order stage 3) is
 * rendered as an overlay inside the same container, and owns left-drag now — drawing a mark is
 * this app's primary interaction, so it gets the gesture. Panning still works via the wheel.
 *
 * This only ever draws the *preview*. Export re-renders straight from the same raster at full
 * resolution through core/redact.js (stage 4), never by sampling this canvas — the preview
 * here is scaled and may be smoothed, so it must never be the source of truth for what gets
 * destroyed.
 */
export default function PageCanvas({ raster, naturalWidth, naturalHeight, viewport, children }) {
  const canvasRef = useRef(null)
  const { containerRef, containerSize, scale, offset, zoomAt, pan } = viewport

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !raster || !containerSize.width || !containerSize.height) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(containerSize.width * dpr)
    canvas.height = Math.round(containerSize.height * dpr)
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, containerSize.width, containerSize.height)
    const drawWidth = naturalWidth * scale
    const drawHeight = naturalHeight * scale
    const drawX = (containerSize.width - drawWidth) / 2 + offset.x
    const drawY = (containerSize.height - drawHeight) / 2 + offset.y
    ctx.drawImage(raster, 0, 0, naturalWidth, naturalHeight, drawX, drawY, drawWidth, drawHeight)
  }, [raster, naturalWidth, naturalHeight, containerSize, scale, offset])

  // Wheel needs `{ passive: false }` to call preventDefault (stopping the page from also
  // scrolling), which React's synthetic onWheel prop doesn't offer — so it's bound manually.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return undefined
    function handleWheel(e) {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const point = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      if (e.ctrlKey || e.metaKey) {
        zoomAt(point, Math.exp(-e.deltaY * WHEEL_ZOOM_RATE))
      } else {
        pan(-e.deltaX, -e.deltaY)
      }
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [containerRef, zoomAt, pan])

  return (
    <div ref={containerRef} className="relative min-h-0 flex-1 overflow-hidden bg-bg">
      <canvas ref={canvasRef} className="h-full w-full" />
      {children}
    </div>
  )
}
