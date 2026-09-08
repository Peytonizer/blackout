import { useCallback, useRef, useState } from 'react'
import { loadImage } from '../load/loadImage.js'

let nextPageId = 0
function makePageId() {
  return `page-${nextPageId++}`
}

/**
 * The single document/page/mark store (SPEC.md's "Core data model"). Exactly one document is
 * open at a time; loading another replaces it.
 *
 * Page rasters are deliberately kept out of this hook's state, in a plain `Map` ref instead —
 * putting a multi-megabyte `ImageBitmap` into `useState` would make every mark drag (once
 * marks exist, from build-order stage 3) re-run reconciliation against that data. `getRaster`
 * is how consumers read a raster without ever putting one in React state themselves.
 */
export function useDocument() {
  const [doc, setDoc] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const rastersRef = useRef(new Map())

  const loadFile = useCallback(async (file) => {
    setLoadError(null)
    let bitmap
    let width
    let height
    try {
      ;({ bitmap, width, height } = await loadImage(file))
    } catch (err) {
      setLoadError(err.message)
      return
    }
    // Loading a new document replaces the old one — free its raster(s) rather than leaking
    // them, since nothing else holds a reference once `doc` is overwritten below.
    for (const raster of rastersRef.current.values()) raster.close()
    const id = makePageId()
    rastersRef.current = new Map([[id, bitmap]])
    setDoc({
      kind: 'image',
      filename: file.name,
      pages: [{ id, width, height, pdfPointSize: null, marks: [] }],
      inspection: null,
    })
  }, [])

  const getRaster = useCallback((id) => rastersRef.current.get(id), [])

  return { doc, loadError, loadFile, getRaster }
}
