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
  const [pagesMeta, setPagesMeta] = useState([]) // [{ id, width, height, pdfPointSize, annotationCount?, formFieldCount?, hasTextLayer? }]
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [histories, setHistories] = useState({}) // pageId -> history
  const [selectedMarkId, setSelectedMarkId] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [metadataFindings, setMetadataFindings] = useState([])
  const [attachmentCount, setAttachmentCount] = useState(null) // PDF only; null for an image
  const [dpi, setDpi] = useState(150) // SPEC.md's default PDF render DPI
  // Whether the current document needed a password to open — SPEC.md's export contract
  // (stage 9) has to warn that the exported copy won't be encrypted, so this has to survive
  // past the password prompt itself into document state.
  const [wasEncrypted, setWasEncrypted] = useState(false)
  // A pending password prompt for the PDF currently loading: { incorrect, attempt, resolve }.
  // `resolve` is the resolver loadPdf's onPasswordRequired is waiting on — submitPassword and
  // cancelPassword call it directly rather than this hook re-deriving the retry flow itself.
  const [passwordRequest, setPasswordRequest] = useState(null)
  const rastersRef = useRef(new Map())
  // Set the moment a password is first requested for the file currently loading — read once
  // loading finishes (see loadFile) rather than kept as state itself, since a load in progress
  // shouldn't affect the *previous* document's wasEncrypted value.
  const encounteredPasswordRef = useRef(false)

  const requestPassword = useCallback(({ incorrect, attempt }) => {
    encounteredPasswordRef.current = true
    return new Promise((resolve) => setPasswordRequest({ incorrect, attempt, resolve }))
  }, [])
  const submitPassword = useCallback((value) => {
    setPasswordRequest((req) => {
      req?.resolve(value)
      return null
    })
  }, [])
  const cancelPassword = useCallback(() => {
    setPasswordRequest((req) => {
      req?.resolve(null)
      return null
    })
  }, [])

  const loadFile = useCallback(
    async (file) => {
      setLoadError(null)
      encounteredPasswordRef.current = false
      let loadedPages // [{ id, width, height, pdfPointSize, bitmap, annotationCount?, formFieldCount?, hasTextLayer? }]
      let loadedKind
      let findings
      let loadedAttachmentCount = null
      try {
        if (file.type === 'application/pdf') {
          // Dynamically imported so pdfjs-dist — a large dependency — never reaches someone
          // who only ever loads images; Vite splits it into its own chunk, fetched only here.
          const { loadPdf } = await import('../load/loadPdf.js')
          const { pages, metadataFindings, attachmentCount: pdfAttachmentCount } = await loadPdf(file, {
            dpi,
            onPasswordRequired: requestPassword,
          })
          loadedPages = pages.map((p) => ({ id: makePageId(), ...p }))
          loadedKind = 'pdf'
          findings = metadataFindings
          loadedAttachmentCount = pdfAttachmentCount
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
      setPagesMeta(
        loadedPages.map(({ id, width, height, pdfPointSize, annotationCount, formFieldCount, hasTextLayer }) => ({
          id,
          width,
          height,
          pdfPointSize,
          annotationCount,
          formFieldCount,
          hasTextLayer,
        })),
      )
      setCurrentPageIndex(0)
      setHistories(Object.fromEntries(loadedPages.map((p) => [p.id, createHistory([])])))
      setSelectedMarkId(null)
      setMetadataFindings(findings)
      setAttachmentCount(loadedAttachmentCount)
      setWasEncrypted(encounteredPasswordRef.current)
    },
    [dpi, requestPassword],
  )

  const getRaster = useCallback((id) => rastersRef.current.get(id), [])

  const currentPageId = pagesMeta[currentPageIndex]?.id ?? null
  const currentHistory = currentPageId ? histories[currentPageId] : null

  const doc = kind && {
    kind,
    filename,
    pages: pagesMeta.map((p) => ({ ...p, marks: histories[p.id]?.present ?? [] })),
    inspection: buildSummary(
      pagesMeta.map((p) => ({ ...p, marks: histories[p.id]?.present ?? [] })),
      metadataFindings,
      attachmentCount,
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
    wasEncrypted,
    passwordRequest,
    submitPassword,
    cancelPassword,
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
