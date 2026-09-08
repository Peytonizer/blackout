import { PDFDocument } from 'pdf-lib'
import { renderPageBlob } from './renderPageBlob.js'

const CODEC_TYPES = { png: 'image/png', jpeg: 'image/jpeg' }
const JPEG_QUALITY = 0.92 // SPEC.md's decisions table: visually clean on 150 DPI text

/**
 * Rebuilds a redacted PDF from scratch via pdf-lib: a brand-new `PDFDocument` that never opens
 * or copies anything from the source document. This is the guarantee for PDFs — the only way
 * to be certain no text object, embedded font glyph, image, annotation, attachment, form field
 * or embedded JavaScript survives under a mark is for none of the source's objects to be
 * carried across at all. Never "optimise" this by copying pages from the source.
 *
 * Each page is redacted at full raster resolution (the same `core/redact.js` path images use,
 * via `renderPageBlob`), then embedded on a page sized to the *original PDF's point size*
 * (`page.pdfPointSize`) — not the redacted raster's pixel size — so the output prints and
 * displays at the same physical size as the source, regardless of the render DPI it was
 * loaded at.
 *
 * `codec` is `'jpeg'` (default, quality 0.92 — visually clean on 150 DPI text and far smaller
 * than PNG on a photographic page) or `'png'` (lossless, larger, for the person who needs it
 * exact).
 *
 * All Info dictionary fields are set to empty strings and both dates to the Unix epoch — pdf-
 * lib stamps its own Producer/Creator if you don't set one, and a 1970 timestamp is
 * deterministic and reads as a deliberate tell that the metadata was cleared, not a plausible
 * real date.
 *
 * Returns the PDF as a `Uint8Array` (pdf-lib's own convention) — wrap it in a `Blob` with type
 * `application/pdf` before downloading it.
 */
export async function exportPdf(pages, getRaster, codec = 'jpeg') {
  const out = await PDFDocument.create()
  for (const page of pages) {
    const blob = await renderPageBlob(getRaster(page.id), page.marks, page.width, page.height, {
      type: CODEC_TYPES[codec],
      quality: codec === 'jpeg' ? JPEG_QUALITY : undefined,
    })
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const img = codec === 'png' ? await out.embedPng(bytes) : await out.embedJpg(bytes)
    const p = out.addPage([page.pdfPointSize.width, page.pdfPointSize.height])
    p.drawImage(img, { x: 0, y: 0, width: p.getWidth(), height: p.getHeight() })
  }

  out.setTitle('')
  out.setAuthor('')
  out.setSubject('')
  out.setKeywords([])
  out.setProducer('')
  out.setCreator('')
  out.setCreationDate(new Date(0))
  out.setModificationDate(new Date(0))

  return out.save()
}
