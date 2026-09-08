import { useCallback, useEffect, useRef, useState } from 'react'

const ACCEPT = 'image/png,image/jpeg,image/webp,application/pdf'
const DPI_OPTIONS = [
  { value: 96, label: '96 DPI', hint: 'smaller file' },
  { value: 150, label: '150 DPI', hint: 'default' },
  { value: 300, label: '300 DPI', hint: 'print quality' },
]

/**
 * The load surface, shown while no document is open: drag-and-drop, a file picker and
 * clipboard paste (SPEC.md feature 1) for PNG/JPEG/WebP/PDF. Anything else is rejected by
 * `loadImage.js` with a message naming the accepted formats.
 *
 * The DPI selector only matters for a PDF — a PDF page has no natural pixel size the way an
 * image does, so this chosen render resolution *becomes* its raster's natural size, once, at
 * load time (SPEC.md's decisions table). It's shown here, before that render happens, rather
 * than as a setting to change afterward.
 */
export default function Dropzone({ onFile, error, dpi, onDpiChange }) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef(null)

  const handleFiles = useCallback(
    (files) => {
      const file = files?.[0]
      if (file) onFile(file)
    },
    [onFile],
  )

  // Paste isn't anchored to an element the way drag/drop is — bind it to the window for as
  // long as this empty-state screen is showing, rather than requiring the dropzone to have
  // focus first.
  useEffect(() => {
    function handlePaste(e) {
      const item = [...e.clipboardData.items].find((i) => i.kind === 'file')
      if (item) handleFiles([item.getAsFile()])
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [handleFiles])

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
        className={`flex w-full flex-col items-center gap-4 rounded border border-dashed px-8 py-12 text-center font-mono text-[12px] transition-colors ${
          isDragging ? 'border-accent text-text' : 'border-border-soft text-text-faint'
        }`}
      >
        <p>Drop a screenshot or PDF here, paste from your clipboard, or</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-[3px] bg-accent px-4 py-2 font-semibold text-bg hover:bg-accent-hover"
        >
          Choose a file
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = '' // allow re-selecting the same file after a rejection
          }}
        />
        <p className="text-text-faintest">PNG, JPEG, WebP or PDF</p>
        {error && <p className="text-accent">{error}</p>}
      </div>
      <div className="flex items-center gap-3 font-mono text-[11px] text-text-faintest">
        <span>PDF render quality:</span>
        {DPI_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onDpiChange(opt.value)}
            title={opt.hint}
            className={opt.value === dpi ? 'text-accent' : 'hover:text-text-faint'}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
