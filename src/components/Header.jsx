import BlackoutMark from './BlackoutMark'

/**
 * The noradz nav, reduced to its wordmark for build-order stage 1 — toolbar controls (zoom,
 * undo/redo, export) land once there's a document to act on, from stage 3 onward.
 */
export default function Header() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-8 py-7 max-[900px]:px-8 min-[901px]:px-[72px]">
      <div className="flex items-center gap-[10px] font-mono text-[15px] tracking-[0.14em]">
        <BlackoutMark />
        <span>BLACKOUT</span>
      </div>
    </header>
  )
}
