import { useEffect, useRef } from 'react'

/**
 * Draws the page raster into a canvas sized to the container, transformed by the shared
 * viewport (`usePageViewport`): centred, then scaled and offset. Panning is a pointer drag;
 * the wheel zooms toward the cursor when Ctrl/Cmd is held (a trackpad pinch reports as a
 * ctrl+wheel event) and pans otherwise, matching the convention most map/canvas apps use.
 *
 * This only ever draws the *preview*. Export re-renders straight from the same raster at full
 * resolution through `core/redact.js` (build-order stage 4), never by sampling this canvas —
 * the preview here is scaled and may be smoothed, so it must never be the source of truth for
 * what gets destroyed.
 */
export default function PageCanvas({ raster, naturalWidth, naturalHeight, viewport }) {
  const canvasRef = useRef(null)
  const dragRef = useRef(null)
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

  // Wheel needs `{ passive: false }` to call preventDefault (stopping the page/container from
  // also scrolling), which React's synthetic onWheel prop doesn't offer — so it's bound
  // manually instead of as JSX.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return undefined
    function handleWheel(e) {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const point = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      if (e.ctrlKey || e.metaKey) {
        zoomAt(point, Math.exp(-e.deltaY * 0.01))
      } else {
        pan(-e.deltaX, -e.deltaY)
      }
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [containerRef, zoomAt, pan])

  function handlePointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { x: e.clientX, y: e.clientY }
  }
  function handlePointerMove(e) {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.x
    const dy = e.clientY - dragRef.current.y
    dragRef.current = { x: e.clientX, y: e.clientY }
    pan(dx, dy)
  }
  function handlePointerUp(e) {
    dragRef.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  return (
    <div ref={containerRef} className="relative min-h-0 flex-1 overflow-hidden bg-bg">
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
    </div>
  )
}
