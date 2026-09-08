import { useCallback, useEffect, useRef, useState } from 'react'

const ACCEPT = 'image/png,image/jpeg,image/webp'

/**
 * The load surface, shown while no document is open: drag-and-drop, a file picker and
 * clipboard paste (SPEC.md feature 1). PDF support (build-order stage 6) will extend `accept`;
 * for now anything that isn't PNG/JPEG/WebP is rejected by `loadImage.js` with a message
 * naming the accepted formats.
 */
export default function Dropzone({ onFile, error }) {
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
      className={`flex w-full max-w-md flex-col items-center gap-4 rounded border border-dashed px-8 py-12 text-center font-mono text-[12px] transition-colors ${
        isDragging ? 'border-accent text-text' : 'border-border-soft text-text-faint'
      }`}
    >
      <p>Drop a screenshot here, paste from your clipboard, or</p>
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
      <p className="text-text-faintest">PNG, JPEG or WebP</p>
      {error && <p className="text-accent">{error}</p>}
    </div>
  )
}
