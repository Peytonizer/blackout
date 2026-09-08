import { Eraser, Maximize, Redo2, Trash2, Undo2, ZoomIn, ZoomOut } from 'lucide-react'

/**
 * The page-view toolbar: zoom controls (build-order stage 2) plus undo/redo and delete/clear
 * over the mark list (stage 3). Delete removes the selected mark; clear removes every mark on
 * the page — both are disabled when there's nothing for them to act on.
 */
export default function Toolbar({
  scale,
  onZoomIn,
  onZoomOut,
  onFit,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  hasSelection,
  onDelete,
  hasMarks,
  onClear,
}) {
  return (
    <div className="flex items-center justify-between gap-1 border-b border-border px-8 py-2 max-[900px]:px-8 min-[901px]:px-[72px]">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onZoomOut}
          aria-label="Zoom out"
          title="Zoom out"
          className="rounded-[3px] p-[6px] text-text-muted hover:text-text"
        >
          <ZoomOut size={16} strokeWidth={1.6} />
        </button>
        <span className="min-w-[3.5em] text-center font-mono text-[11px] text-text-faint">
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          onClick={onZoomIn}
          aria-label="Zoom in"
          title="Zoom in"
          className="rounded-[3px] p-[6px] text-text-muted hover:text-text"
        >
          <ZoomIn size={16} strokeWidth={1.6} />
        </button>
        <button
          type="button"
          onClick={onFit}
          aria-label="Fit to window"
          title="Fit to window"
          className="rounded-[3px] p-[6px] text-text-muted hover:text-text"
        >
          <Maximize size={16} strokeWidth={1.6} />
        </button>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo"
          title="Undo"
          className="rounded-[3px] p-[6px] text-text-muted enabled:hover:text-text disabled:opacity-30"
        >
          <Undo2 size={16} strokeWidth={1.6} />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          aria-label="Redo"
          title="Redo"
          className="rounded-[3px] p-[6px] text-text-muted enabled:hover:text-text disabled:opacity-30"
        >
          <Redo2 size={16} strokeWidth={1.6} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={!hasSelection}
          aria-label="Delete selected mark"
          title="Delete selected mark"
          className="rounded-[3px] p-[6px] text-text-muted enabled:hover:text-accent disabled:opacity-30"
        >
          <Trash2 size={16} strokeWidth={1.6} />
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={!hasMarks}
          aria-label="Clear all marks"
          title="Clear all marks"
          className="rounded-[3px] p-[6px] text-text-muted enabled:hover:text-accent disabled:opacity-30"
        >
          <Eraser size={16} strokeWidth={1.6} />
        </button>
      </div>
    </div>
  )
}
