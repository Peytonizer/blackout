import { useCallback, useRef, useState } from 'react'
import {
  canRedo as historyCanRedo,
  canUndo as historyCanUndo,
  commit,
  createHistory,
  redo as historyRedo,
  undo as historyUndo,
} from '../core/history.js'
import { imageMeta } from '../inspect/imageMeta.js'
import { buildSummary } from '../inspect/summary.js'
import { loadImage } from '../load/loadImage.js'

let nextPageId = 0
function makePageId() {
  return `page-${nextPageId++}`
}

let nextMarkId = 0
function makeMarkId() {
  return `mark-${nextMarkId++}`
}

/**
 * The single document/page/mark store (SPEC.md's "Core data model"). Exactly one document is
 * open at a time; loading another replaces it. An image is just a one-page document — a PDF's
 * multiple pages are what make `pagesMeta`/`histories` arrays and maps rather than single
 * values, and everything downstream (marks, undo/redo, export) is written against "the current
 * page" so it doesn't need to know which kind of document it's in.
 *
 * Page rasters are deliberately kept out of this hook's state, in a plain `Map` ref instead —
 * putting a multi-megabyte `ImageBitmap` into `useState` would make every mark drag re-run
 * reconciliation against that data. `getRaster` is how consumers read a raster without ever
 * putting one in React state themselves.
 *
 * Marks and their undo/redo history are the other way around: each page gets its own
 * `core/history.js` snapshot stack, keyed by page id in `histories`, so switching pages doesn't
 * lose or mix up either page's history. `doc` is assembled from `pagesMeta` plus
 * `histories[id].present` on every render — there's no separate "marks" state to keep in sync.
 */
export function useDocument() {
  const [kind, setKind] = useState(null)
  const [filename, setFilename] = useState(null)
  const [pagesMeta, setPagesMeta] = useState([]) // [{ id, width, height, pdfPointSize }]
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [histories, setHistories] = useState({}) // pageId -> history
  const [selectedMarkId, setSelectedMarkId] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [metadataFindings, setMetadataFindings] = useState([])
  const [dpi, setDpi] = useState(150) // SPEC.md's default PDF render DPI
  const rastersRef = useRef(new Map())
  // Password-protected PDFs land next (build-order stage 6's second half) — for now loadPdf
  // is called with no onPasswordRequired, so one fails fast with a clear message via loadError
  // instead of the UI hanging on an unresolved prompt.

  const loadFile = useCallback(
    async (file) => {
      setLoadError(null)
      let loadedPages // [{ id, width, height, pdfPointSize, bitmap }]
      let loadedKind
      let findings
      try {
        if (file.type === 'application/pdf') {
          // Dynamically imported so pdfjs-dist — a large dependency — never reaches someone
          // who only ever loads images; Vite splits it into its own chunk, fetched only here.
          const { loadPdf } = await import('../load/loadPdf.js')
          const { pages } = await loadPdf(file, { dpi })
          loadedPages = pages.map((p) => ({ id: makePageId(), ...p }))
          loadedKind = 'pdf'
          findings = [] // PDF metadata inspection is build-order stage 7
        } else {
          const [{ bitmap, width, height }, imgFindings] = await Promise.all([loadImage(file), imageMeta(file)])
          loadedPages = [{ id: makePageId(), width, height, pdfPointSize: null, bitmap }]
          loadedKind = 'image'
          findings = imgFindings
        }
      } catch (err) {
        setLoadError(err.message)
        return
      }

      // Loading a new document replaces the old one — free its raster(s) rather than leaking
      // them, since nothing else holds a reference once pagesMeta is overwritten below.
      for (const raster of rastersRef.current.values()) raster.close()
      rastersRef.current = new Map(loadedPages.map((p) => [p.id, p.bitmap]))

      setKind(loadedKind)
      setFilename(file.name)
      setPagesMeta(loadedPages.map(({ id, width, height, pdfPointSize }) => ({ id, width, height, pdfPointSize })))
      setCurrentPageIndex(0)
      setHistories(Object.fromEntries(loadedPages.map((p) => [p.id, createHistory([])])))
      setSelectedMarkId(null)
      setMetadataFindings(findings)
    },
    [dpi],
  )

  const getRaster = useCallback((id) => rastersRef.current.get(id), [])

  const currentPageId = pagesMeta[currentPageIndex]?.id ?? null
  const currentHistory = currentPageId ? histories[currentPageId] : null

  const doc = kind && {
    kind,
    filename,
    pages: pagesMeta.map((p) => ({ ...p, marks: histories[p.id]?.present ?? [] })),
    inspection: buildSummary(
      pagesMeta.map((p) => ({ id: p.id, marks: histories[p.id]?.present ?? [] })),
      metadataFindings,
    ),
  }

  const selectPage = useCallback((index) => {
    setCurrentPageIndex(index)
    setSelectedMarkId(null) // a selected mark doesn't carry across pages
  }, [])

  const addMark = useCallback(
    (rect) => {
      if (!currentPageId) return
      const id = makeMarkId()
      setHistories((h) => ({ ...h, [currentPageId]: commit(h[currentPageId], [...h[currentPageId].present, { id, ...rect }]) }))
      setSelectedMarkId(id)
    },
    [currentPageId],
  )

  const updateMark = useCallback(
    (id, rect) => {
      if (!currentPageId) return
      setHistories((h) => ({
        ...h,
        [currentPageId]: commit(h[currentPageId], h[currentPageId].present.map((m) => (m.id === id ? { ...m, ...rect } : m))),
      }))
    },
    [currentPageId],
  )

  const deleteMark = useCallback(
    (id) => {
      if (!currentPageId) return
      setHistories((h) => ({ ...h, [currentPageId]: commit(h[currentPageId], h[currentPageId].present.filter((m) => m.id !== id)) }))
      setSelectedMarkId((sel) => (sel === id ? null : sel))
    },
    [currentPageId],
  )

  const clearMarks = useCallback(() => {
    if (!currentPageId) return
    setHistories((h) => ({ ...h, [currentPageId]: commit(h[currentPageId], []) }))
    setSelectedMarkId(null)
  }, [currentPageId])

  // Undo/redo can remove the mark that's currently selected (or bring back one that wasn't) —
  // simplest and safest to just drop the selection rather than try to track it through history.
  const undoMarks = useCallback(() => {
    if (!currentPageId) return
    setHistories((h) => ({ ...h, [currentPageId]: historyUndo(h[currentPageId]) }))
    setSelectedMarkId(null)
  }, [currentPageId])

  const redoMarks = useCallback(() => {
    if (!currentPageId) return
    setHistories((h) => ({ ...h, [currentPageId]: historyRedo(h[currentPageId]) }))
    setSelectedMarkId(null)
  }, [currentPageId])

  return {
    doc,
    loadError,
    loadFile,
    getRaster,
    dpi,
    setDpi,
    currentPageIndex,
    selectPage,
    selectedMarkId,
    selectMark: setSelectedMarkId,
    addMark,
    updateMark,
    deleteMark,
    clearMarks,
    undo: undoMarks,
    redo: redoMarks,
    canUndo: currentHistory ? historyCanUndo(currentHistory) : false,
    canRedo: currentHistory ? historyCanRedo(currentHistory) : false,
  }
}
