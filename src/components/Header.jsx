import { Download } from 'lucide-react'
import BlackoutMark from './BlackoutMark'

/**
 * The noradz nav, wordmark plus — once a document is loaded — the export button, and for a
 * PDF, the JPEG/PNG codec toggle (SPEC.md's decisions table: JPEG at quality 0.92 by default,
 * a "lossless (PNG)" option for the person who needs it exact). Export is the one accent-red
 * action outside the mark chrome itself: red means "this cannot be undone" and nothing else in
 * this app (SPEC.md's Visual Design section).
 */
export default function Header({ onExport, pdfCodec, onPdfCodecChange }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-8 py-7 max-[900px]:px-8 min-[901px]:px-[72px]">
      <div className="flex items-center gap-[10px] font-mono text-[15px] tracking-[0.14em]">
        <BlackoutMark />
        <span>BLACKOUT</span>
      </div>
      {onExport && (
        <div className="flex items-center gap-4">
          {pdfCodec && (
            <div className="flex items-center gap-2 font-mono text-[11px] text-text-faintest">
              <button
                type="button"
                onClick={() => onPdfCodecChange('jpeg')}
                className={pdfCodec === 'jpeg' ? 'text-accent' : 'hover:text-text-faint'}
              >
                JPEG
              </button>
              <button
                type="button"
                onClick={() => onPdfCodecChange('png')}
                className={pdfCodec === 'png' ? 'text-accent' : 'hover:text-text-faint'}
              >
                PNG (lossless)
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={onExport}
            className="flex items-center gap-2 rounded-[3px] bg-accent px-4 py-2 font-mono text-[12px] font-semibold text-bg hover:bg-accent-hover"
          >
            <Download size={14} strokeWidth={1.8} />
            Export
          </button>
        </div>
      )}
    </header>
  )
}
