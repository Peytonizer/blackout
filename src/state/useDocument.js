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
 * open at a time; loading another replaces it.
 *
 * Page rasters are deliberately kept out of this hook's state, in a plain `Map` ref instead —
 * putting a multi-megabyte `ImageBitmap` into `useState` would make every mark drag re-run
 * reconciliation against that data. `getRaster` is how consumers read a raster without ever
 * putting one in React state themselves.
 *
 * Marks and their undo/redo history are the other way around: `core/history.js`'s snapshot
 * stack (`history.present`) is the single source of truth for the current page's marks, so
 * there's no separate "marks" state to keep in sync with it — `doc` is assembled from
 * `pageMeta` plus `history.present` on every render. This assumes a single page (true through
 * build-order stage 5); multi-page PDFs (stage 6) will need one history per page, at which
 * point this should become a Map keyed by page id.
 */
export function useDocument() {
  const [pageMeta, setPageMeta] = useState(null)
  const [history, setHistory] = useState(() => createHistory([]))
  const [selectedMarkId, setSelectedMarkId] = useState(null)
  const [loadError, setLoadError] = useState(null)
  // Metadata findings are fixed at load time (unlike marks, they never change afterward), so
  // they live in their own bit of state rather than being recomputed on every render.
  const [metadataFindings, setMetadataFindings] = useState([])
  const rastersRef = useRef(new Map())

  const loadFile = useCallback(async (file) => {
    setLoadError(null)
    let bitmap
    let width
    let height
    let findings
    try {
      // Run together: imageMeta reads its own slice of the file independently of decoding it,
      // and never rejects on a bad format itself (it just reports nothing found), so only
      // loadImage's rejection reason ever surfaces here.
      ;[{ bitmap, width, height }, findings] = await Promise.all([loadImage(file), imageMeta(file)])
    } catch (err) {
      setLoadError(err.message)
      return
    }
    // Loading a new document replaces the old one — free its raster(s) rather than leaking
    // them, since nothing else holds a reference once pageMeta is overwritten below.
    for (const raster of rastersRef.current.values()) raster.close()
    const id = makePageId()
    rastersRef.current = new Map([[id, bitmap]])
    setPageMeta({ id, width, height, pdfPointSize: null, kind: 'image', filename: file.name })
    setHistory(createHistory([]))
    setSelectedMarkId(null)
    setMetadataFindings(findings)
  }, [])

  const getRaster = useCallback((id) => rastersRef.current.get(id), [])

  const doc = pageMeta && {
    kind: pageMeta.kind,
    filename: pageMeta.filename,
    pages: [
      {
        id: pageMeta.id,
        width: pageMeta.width,
        height: pageMeta.height,
        pdfPointSize: pageMeta.pdfPointSize,
        marks: history.present,
      },
    ],
    inspection: buildSummary(
      [{ id: pageMeta.id, marks: history.present }],
      metadataFindings,
    ),
  }

  const addMark = useCallback((rect) => {
    const id = makeMarkId()
    setHistory((h) => commit(h, [...h.present, { id, ...rect }]))
    setSelectedMarkId(id)
  }, [])

  const updateMark = useCallback((id, rect) => {
    setHistory((h) => commit(h, h.present.map((m) => (m.id === id ? { ...m, ...rect } : m))))
  }, [])

  const deleteMark = useCallback((id) => {
    setHistory((h) => commit(h, h.present.filter((m) => m.id !== id)))
    setSelectedMarkId((sel) => (sel === id ? null : sel))
  }, [])

  const clearMarks = useCallback(() => {
    setHistory((h) => commit(h, []))
    setSelectedMarkId(null)
  }, [])

  // Undo/redo can remove the mark that's currently selected (or bring back one that wasn't) —
  // simplest and safest to just drop the selection rather than try to track it through history.
  const undoMarks = useCallback(() => {
    setHistory(historyUndo)
    setSelectedMarkId(null)
  }, [])

  const redoMarks = useCallback(() => {
    setHistory(historyRedo)
    setSelectedMarkId(null)
  }, [])

  return {
    doc,
    loadError,
    loadFile,
    getRaster,
    selectedMarkId,
    selectMark: setSelectedMarkId,
    addMark,
    updateMark,
    deleteMark,
    clearMarks,
    undo: undoMarks,
    redo: redoMarks,
    canUndo: historyCanUndo(history),
    canRedo: historyCanRedo(history),
  }
}
