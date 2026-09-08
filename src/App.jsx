import { useEffect, useState } from 'react'
import Dropzone from './components/Dropzone'
import ExportPanel from './components/ExportPanel'
import Footer from './components/Footer'
import Header from './components/Header'
import MarkLayer from './components/MarkLayer'
import PageCanvas from './components/PageCanvas'
import PageStrip from './components/PageStrip'
import PdfPasswordPrompt from './components/PdfPasswordPrompt'
import RemovalSummary from './components/RemovalSummary'
import Toolbar from './components/Toolbar'
import { downloadBlob, redactedFilename } from './export/download.js'
import { exportImage } from './export/exportImage.js'
import { useDocument } from './state/useDocument.js'
import { usePageViewport } from './state/usePageViewport.js'

/**
 * The application shell. Build-order stage 9: the export contract — before a PDF export runs,
 * ExportPanel states its real costs (file grows, selectable text lost, an encrypted source
 * exports unencrypted, no undo) and requires a deliberate confirmation. An image export has
 * none of those costs (same pixels, PNG out, nothing lost) and runs directly, as it always has.
 */
function App() {
  const {
    doc,
    loadError,
    loadFile,
    getRaster,
    dpi,
    setDpi,
    wasEncrypted,
    passwordRequest,
    submitPassword,
    cancelPassword,
    currentPageIndex,
    selectPage,
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
  const page = doc?.pages[currentPageIndex] ?? null
  // Called unconditionally (hook rules) with 0x0 before a page is loaded — usePageViewport
  // treats that as "no fit possible yet" and falls back to scale 1. Switching pages changes
  // naturalWidth/Height too, which re-fits the viewport to the newly selected page.
  const viewport = usePageViewport(page?.width ?? 0, page?.height ?? 0)

  // JPEG vs lossless PNG for a PDF's rasterised pages (SPEC.md's decisions table). Not
  // document state — it's an export preference, and there's nothing wrong with it persisting
  // as a "last choice" convenience across loading a different file.
  const [pdfCodec, setPdfCodec] = useState('jpeg')
  // Whether ExportPanel's confirmation is currently open, for a PDF export awaiting the user's
  // go-ahead. An image export has nothing to confirm and never sets this.
  const [pendingExport, setPendingExport] = useState(false)

  // Full-resolution redacted export, from the raster ref map — never from PageCanvas's scaled
  // preview canvas (SPEC.md). A PDF is rebuilt whole (every page, via exportPdf.js) rather than
  // exporting just the page currently in view.
  const runExport = async () => {
    if (doc.kind === 'pdf') {
      // Dynamically imported so pdf-lib never reaches someone who only exports images.
      const { exportPdf } = await import('./export/exportPdf.js')
      const bytes = await exportPdf(doc.pages, getRaster, pdfCodec)
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), redactedFilename(doc.filename, 'pdf'))
    } else {
      const blob = await exportImage(getRaster(page.id), page.marks, page.width, page.height)
      downloadBlob(blob, redactedFilename(doc.filename))
    }
  }

  const handleExport = page
    ? () => {
        if (doc.kind === 'pdf') setPendingExport(true)
        else runExport()
      }
    : undefined

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
      <Header onExport={handleExport} pdfCodec={doc?.kind === 'pdf' ? pdfCodec : null} onPdfCodecChange={setPdfCodec} />
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
          <RemovalSummary inspection={doc.inspection} />
          <PageStrip pages={doc.pages} currentPageIndex={currentPageIndex} onSelectPage={selectPage} getRaster={getRaster} />
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
          <Dropzone onFile={loadFile} error={loadError} dpi={dpi} onDpiChange={setDpi} />
        </main>
      )}
      <PdfPasswordPrompt request={passwordRequest} onSubmit={submitPassword} onCancel={cancelPassword} />
      <ExportPanel
        open={pendingExport}
        hasTextLayer={!!doc?.inspection.hasTextLayer}
        wasEncrypted={wasEncrypted}
        onConfirm={() => {
          setPendingExport(false)
          runExport()
        }}
        onCancel={() => setPendingExport(false)}
      />
      <Footer />
    </div>
  )
}

export default App
