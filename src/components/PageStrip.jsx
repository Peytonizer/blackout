import { useEffect, useRef } from 'react'

// Small enough to stay a strip, big enough that a page is still recognisable.
const THUMB_HEIGHT = 48

function PageThumbnail({ raster, width, height }) {
  const canvasRef = useRef(null)
  const thumbWidth = Math.max(1, Math.round((width / height) * THUMB_HEIGHT))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !raster) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(raster, 0, 0, thumbWidth, THUMB_HEIGHT)
  }, [raster, thumbWidth])

  return <canvas ref={canvasRef} width={thumbWidth} height={THUMB_HEIGHT} className="bg-bg" />
}

/**
 * Page thumbnails for a multi-page PDF, each showing its own mark count, letting you switch
 * which page is being viewed and marked (SPEC.md feature 2). A single-page document (every
 * image, and a one-page PDF) has nothing to switch between, so this renders nothing.
 */
export default function PageStrip({ pages, currentPageIndex, onSelectPage, getRaster }) {
  if (pages.length <= 1) return null

  return (
    <div className="flex gap-2 overflow-x-auto border-b border-border bg-surface px-8 py-3 max-[900px]:px-8 min-[901px]:px-[72px]">
      {pages.map((page, index) => (
        <button
          key={page.id}
          type="button"
          onClick={() => onSelectPage(index)}
          aria-current={index === currentPageIndex}
          className={`flex shrink-0 flex-col items-center gap-1 rounded-[3px] border p-1 ${
            index === currentPageIndex ? 'border-accent' : 'border-border-soft hover:border-text-faint'
          }`}
        >
          <PageThumbnail raster={getRaster(page.id)} width={page.width} height={page.height} />
          <span className="font-mono text-[10px] text-text-faint">
            {index + 1}
            {page.marks.length > 0 ? ` · ${page.marks.length}` : ''}
          </span>
        </button>
      ))}
    </div>
  )
}
