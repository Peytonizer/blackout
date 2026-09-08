import { Maximize, ZoomIn, ZoomOut } from 'lucide-react'

/**
 * The page-view toolbar. Stage 2 (SPEC.md build order) only needs zoom in/out/fit; undo, redo,
 * delete and clear join once marks exist (stage 3).
 */
export default function Toolbar({ scale, onZoomIn, onZoomOut, onFit }) {
  return (
    <div className="flex items-center gap-1 border-b border-border px-8 py-2 max-[900px]:px-8 min-[901px]:px-[72px]">
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
  )
}
