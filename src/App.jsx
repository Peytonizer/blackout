import Footer from './components/Footer'
import Header from './components/Header'

/**
 * The application shell for build-order stage 1: header, footer, and a placeholder main area.
 * No document loading, marking or export logic yet — that starts at stage 2 with the dropzone.
 */
function App() {
  return (
    <div className="flex min-h-svh flex-col">
      <Header />
      <main className="flex min-h-0 flex-1 items-center justify-center px-8 py-8 max-[900px]:px-8 min-[901px]:px-[72px]">
        <p className="font-mono text-[12px] text-text-faint">Drop a screenshot or a PDF to get started.</p>
      </main>
      <Footer />
    </div>
  )
}

export default App
