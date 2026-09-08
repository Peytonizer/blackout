import { useRef, useState } from 'react'
import { HANDLES, clampPosition, clampRect, handlePoint, isDegenerate, moveRect, normalizeRect, resizeRect } from '../core/marks.js'
import { toNormalizedPoint, toScreenPoint, toScreenRect } from '../core/units.js'

const HANDLE_SIZE = 6 // px — SPEC.md's "6px accent-red corner handles"
const HANDLE_CURSORS = { nw: 'nwse-resize', n: 'ns-resize', ne: 'nesw-resize', e: 'ew-resize', se: 'nwse-resize', s: 'ns-resize', sw: 'nesw-resize', w: 'ew-resize' }

/**
 * The mark overlay: draws each mark as an opaque black rect with an accent-red outline plus,
 * on the selected mark, its 8 resize handles — and owns the pointer interaction for creating,
 * selecting, moving and resizing marks (SPEC.md feature 3). Sits on top of PageCanvas inside
 * the same viewport-transformed container, using the exact toScreenRect/toScreenPoint geometry
 * PageCanvas uses to draw the raster, so a mark always lines up with the pixels it will
 * destroy on export.
 *
 * A drag is only committed (via onCreate/onUpdate) on pointerup — while it's in progress, the
 * dragged mark's rect is tracked locally in `draft` and rendered live, so a move or resize
 * doesn't flood undo history with one entry per pointermove frame.
 */
export default function MarkLayer({ marks, selectedMarkId, onSelect, onCreate, onUpdate, naturalWidth, naturalHeight, viewport }) {
  const { containerSize, scale, offset } = viewport
  const overlayRef = useRef(null)
  const dragRef = useRef(null) // { mode: 'create'|'move'|'resize', id, handle, origin, originalRect }
  const [draft, setDraft] = useState(null) // { mode, id, handle, rect } — live, uncommitted state for the active drag

  function pointFromEvent(e) {
    const rect = overlayRef.current.getBoundingClientRect()
    const point = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    return toNormalizedPoint(point, naturalWidth, naturalHeight, containerSize, scale, offset)
  }

  // Reaches the overlay only for a pointerdown that missed every mark and handle — those stop
  // propagation in their own handlers below.
  function handleBackgroundPointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId)
    const point = pointFromEvent(e)
    dragRef.current = { mode: 'create', origin: point }
    setDraft({ mode: 'create', id: null, handle: null, rect: { x: point.x, y: point.y, w: 0, h: 0 } })
  }

  function handleMarkPointerDown(mark) {
    return (e) => {
      e.stopPropagation()
      e.currentTarget.setPointerCapture(e.pointerId)
      onSelect(mark.id)
      const point = pointFromEvent(e)
      dragRef.current = { mode: 'move', id: mark.id, origin: point, originalRect: mark }
      setDraft({ mode: 'move', id: mark.id, rect: mark })
    }
  }

  function handleHandlePointerDown(mark, handle) {
    return (e) => {
      e.stopPropagation()
      e.currentTarget.setPointerCapture(e.pointerId)
      const point = pointFromEvent(e)
      dragRef.current = { mode: 'resize', id: mark.id, handle, origin: point, originalRect: mark }
      setDraft({ mode: 'resize', id: mark.id, handle, rect: mark })
    }
  }

  function handlePointerMove(e) {
    const drag = dragRef.current
    if (!drag) return
    const point = pointFromEvent(e)
    if (drag.mode === 'create') {
      setDraft({ mode: 'create', id: null, handle: null, rect: normalizeRect(drag.origin.x, drag.origin.y, point.x, point.y) })
    } else if (drag.mode === 'move') {
      const rect = clampPosition(moveRect(drag.originalRect, point.x - drag.origin.x, point.y - drag.origin.y))
      setDraft({ mode: 'move', id: drag.id, rect })
    } else if (drag.mode === 'resize') {
      const rect = clampRect(resizeRect(drag.originalRect, drag.handle, point.x - drag.origin.x, point.y - drag.origin.y))
      setDraft({ mode: 'resize', id: drag.id, handle: drag.handle, rect })
    }
  }

  function handlePointerUp() {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag || !draft) {
      setDraft(null)
      return
    }
    if (draft.mode === 'create') {
      if (!isDegenerate(draft.rect)) onCreate(clampRect(draft.rect))
      else onSelect(null) // a click with no real drag deselects rather than creating a sliver mark
    } else {
      onUpdate(draft.id, draft.rect)
    }
    setDraft(null)
  }

  // The mark currently being dragged shows its live draft position; everything else renders
  // as committed. A 'create' drag has no id yet, so it's drawn separately, below.
  const displayMarks = marks.map((m) => (draft && draft.mode !== 'create' && draft.id === m.id ? { ...m, ...draft.rect } : m))
  const draftRect = draft?.mode === 'create' ? draft.rect : null

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 cursor-crosshair touch-none select-none"
      onPointerDown={handleBackgroundPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {displayMarks.map((mark) => {
        const screen = toScreenRect(mark, naturalWidth, naturalHeight, containerSize, scale, offset)
        const selected = mark.id === selectedMarkId
        return (
          <div key={mark.id} className="pointer-events-none absolute" style={{ left: screen.x, top: screen.y, width: screen.w, height: screen.h }}>
            <div
              onPointerDown={handleMarkPointerDown(mark)}
              className={`pointer-events-auto absolute inset-0 cursor-move bg-black ${selected ? 'outline outline-1 outline-accent' : ''}`}
            />
            {selected &&
              HANDLES.map((handle) => {
                const hp = toScreenPoint(handlePoint(mark, handle), naturalWidth, naturalHeight, containerSize, scale, offset)
                return (
                  <div
                    key={handle}
                    onPointerDown={handleHandlePointerDown(mark, handle)}
                    className="pointer-events-auto absolute rounded-[1px] bg-accent"
                    style={{
                      left: hp.x - screen.x - HANDLE_SIZE / 2,
                      top: hp.y - screen.y - HANDLE_SIZE / 2,
                      width: HANDLE_SIZE,
                      height: HANDLE_SIZE,
                      cursor: HANDLE_CURSORS[handle],
                    }}
                  />
                )
              })}
          </div>
        )
      })}
      {draftRect && draftRect.w > 0 && draftRect.h > 0 && (
        <div
          className="pointer-events-none absolute bg-black outline outline-1 outline-accent"
          style={(() => {
            const screen = toScreenRect(draftRect, naturalWidth, naturalHeight, containerSize, scale, offset)
            return { left: screen.x, top: screen.y, width: screen.w, height: screen.h }
          })()}
        />
      )}
    </div>
  )
}
