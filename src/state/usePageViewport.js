import { useCallback, useEffect, useRef, useState } from 'react'

const MIN_SCALE = 0.05
const MAX_SCALE = 20
const ZOOM_STEP = 1.25

function clampScale(scale) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
}

function computeFitScale(size, naturalWidth, naturalHeight) {
  if (!naturalWidth || !naturalHeight || !size.width || !size.height) return 1
  return clampScale(Math.min(size.width / naturalWidth, size.height / naturalHeight))
}

/**
 * Pan/zoom state for the page currently on screen. `PageCanvas` draws with it, `Toolbar`'s
 * zoom controls act on it, and a future `MarkLayer` (build-order stage 3) will read the same
 * transform to place mark handles over the same pixels `PageCanvas` is drawing — which is why
 * this lives in its own hook rather than as state local to `PageCanvas`.
 *
 * `scale` and `offset` are in CSS pixels. `offset` is the translation away from the image's
 * centred position, so `{x: 0, y: 0}` always means "centred in the container at this scale".
 * This is purely a *display* transform — it has no bearing on the normalised, outward-rounded
 * geometry `core/units.js` will use for marks and export.
 */
export function usePageViewport(naturalWidth, naturalHeight) {
  const containerRef = useRef(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [viewport, setViewport] = useState({ scale: 1, offset: { x: 0, y: 0 } })
  // Whether the current view still IS the fit-to-window view, so a window resize can keep it
  // fitted — but only until the user zooms or pans by hand, after which a resize shouldn't
  // yank the view back to fit underneath them.
  const isFittedRef = useRef(true)

  // No parameters: this is exposed to Toolbar as an onClick handler, and a button's onClick
  // hands its handler the native click event as the first argument — a `size` parameter here
  // (even with a default) would silently receive that event instead of being defaulted, which
  // is exactly what happened during stage-2 testing. Always read the current containerSize.
  const fit = useCallback(() => {
    isFittedRef.current = true
    setViewport({ scale: computeFitScale(containerSize, naturalWidth, naturalHeight), offset: { x: 0, y: 0 } })
  }, [containerSize, naturalWidth, naturalHeight])

  // Measure the container and keep it fitted across resizes.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return undefined
    const observer = new ResizeObserver(([entry]) => {
      const size = { width: entry.contentRect.width, height: entry.contentRect.height }
      setContainerSize(size)
      if (isFittedRef.current) {
        setViewport({ scale: computeFitScale(size, naturalWidth, naturalHeight), offset: { x: 0, y: 0 } })
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [naturalWidth, naturalHeight])

  // A newly loaded page (natural size changed) always starts fitted. `fit` is intentionally
  // left out of the dependency list: re-running it on every containerSize change would fight
  // the ResizeObserver above, which already re-fits on resize while isFittedRef is true.
  useEffect(() => {
    fit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [naturalWidth, naturalHeight])

  // Zooms by `factor`, keeping the image-space point under `point` (container-relative CSS
  // pixels) fixed on screen — the standard "zoom toward the cursor" behaviour.
  const zoomAt = useCallback(
    (point, factor) => {
      isFittedRef.current = false
      setViewport((prev) => {
        const newScale = clampScale(prev.scale * factor)
        const drawWidth = naturalWidth * prev.scale
        const drawHeight = naturalHeight * prev.scale
        const imgX = (point.x - (containerSize.width - drawWidth) / 2 - prev.offset.x) / prev.scale
        const imgY = (point.y - (containerSize.height - drawHeight) / 2 - prev.offset.y) / prev.scale
        const newDrawWidth = naturalWidth * newScale
        const newDrawHeight = naturalHeight * newScale
        return {
          scale: newScale,
          offset: {
            x: point.x - (containerSize.width - newDrawWidth) / 2 - imgX * newScale,
            y: point.y - (containerSize.height - newDrawHeight) / 2 - imgY * newScale,
          },
        }
      })
    },
    [containerSize, naturalWidth, naturalHeight],
  )

  // Not wrapped in useCallback: `center` is a fresh object every render regardless (it's
  // derived from containerSize), so memoising here would buy nothing.
  function zoomIn() {
    zoomAt({ x: containerSize.width / 2, y: containerSize.height / 2 }, ZOOM_STEP)
  }
  function zoomOut() {
    zoomAt({ x: containerSize.width / 2, y: containerSize.height / 2 }, 1 / ZOOM_STEP)
  }

  const pan = useCallback((dx, dy) => {
    isFittedRef.current = false
    setViewport((prev) => ({ ...prev, offset: { x: prev.offset.x + dx, y: prev.offset.y + dy } }))
  }, [])

  return {
    containerRef,
    containerSize,
    scale: viewport.scale,
    offset: viewport.offset,
    zoomIn,
    zoomOut,
    fit,
    zoomAt,
    pan,
  }
}
