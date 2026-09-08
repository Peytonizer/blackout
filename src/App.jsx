import Dropzone from './components/Dropzone'
import Footer from './components/Footer'
import Header from './components/Header'
import PageCanvas from './components/PageCanvas'
import Toolbar from './components/Toolbar'
import { useDocument } from './state/useDocument.js'
import { usePageViewport } from './state/usePageViewport.js'

/**
 * The application shell. Build-order stage 2: load and view a single image. Marks (stage 3),
 * multi-page PDFs (stage 6) and export (stages 4/8) land in later stages.
 */
function App() {
  const { doc, loadError, loadFile, getRaster } = useDocument()
  const page = doc?.pages[0] ?? null
  // Called unconditionally (hook rules) with 0x0 before a page is loaded — usePageViewport
  // treats that as "no fit possible yet" and falls back to scale 1.
  const viewport = usePageViewport(page?.width ?? 0, page?.height ?? 0)

  return (
    <div className="flex min-h-svh flex-col">
      <Header />
      {page ? (
        <>
          <Toolbar scale={viewport.scale} onZoomIn={viewport.zoomIn} onZoomOut={viewport.zoomOut} onFit={viewport.fit} />
          <PageCanvas
            raster={getRaster(page.id)}
            naturalWidth={page.width}
            naturalHeight={page.height}
            viewport={viewport}
          />
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
