import { useEffect } from 'react'
import Dropzone from './components/Dropzone'
import Footer from './components/Footer'
import Header from './components/Header'
import MarkLayer from './components/MarkLayer'
import PageCanvas from './components/PageCanvas'
import Toolbar from './components/Toolbar'
import { useDocument } from './state/useDocument.js'
import { usePageViewport } from './state/usePageViewport.js'

/**
 * The application shell. Build-order stage 3: mark, select, move, resize and delete rectangles
 * on a loaded image, with undo/redo. Multi-page PDFs (stage 6) and export (stages 4/8) land in
 * later stages.
 */
function App() {
  const {
    doc,
    loadError,
    loadFile,
    getRaster,
    selectedMarkId,
    selectMark,
    addMark,
    updateMark,
    deleteMark,
    clearMarks,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useDocument()
  const page = doc?.pages[0] ?? null
  // Called unconditionally (hook rules) with 0x0 before a page is loaded — usePageViewport
  // treats that as "no fit possible yet" and falls back to scale 1.
  const viewport = usePageViewport(page?.width ?? 0, page?.height ?? 0)

  // Delete/Backspace removes the selected mark, alongside Toolbar's delete button.
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedMarkId) {
        e.preventDefault()
        deleteMark(selectedMarkId)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedMarkId, deleteMark])

  return (
    <div className="flex min-h-svh flex-col">
      <Header />
      {page ? (
        <>
          <Toolbar
            scale={viewport.scale}
            onZoomIn={viewport.zoomIn}
            onZoomOut={viewport.zoomOut}
            onFit={viewport.fit}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            hasSelection={selectedMarkId != null}
            onDelete={() => deleteMark(selectedMarkId)}
            hasMarks={page.marks.length > 0}
            onClear={clearMarks}
          />
          <PageCanvas raster={getRaster(page.id)} naturalWidth={page.width} naturalHeight={page.height} viewport={viewport}>
            <MarkLayer
              marks={page.marks}
              selectedMarkId={selectedMarkId}
              onSelect={selectMark}
              onCreate={addMark}
              onUpdate={updateMark}
              naturalWidth={page.width}
              naturalHeight={page.height}
              viewport={viewport}
            />
          </PageCanvas>
        </>
      ) : (
        <main className="flex min-h-0 flex-1 items-center justify-center px-8 py-8 max-[900px]:px-8 min-[901px]:px-[72px]">
          <Dropzone onFile={loadFile} error={loadError} />
        </main>
      )}
      <Footer />
    </div>
  )
}

export default App
