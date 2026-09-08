// Reads metadata from an already-open pdf.js document — presence and counts only, never a
// value (SPEC.md: the file is about to be shared). Removal is automatic (a rebuilt PDF carries
// none of the source document's objects, per core/redact.js and export/exportPdf.js); this
// module exists purely so the removal summary can tell the truth about what was there.

const INFO_FIELDS = ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer', 'CreationDate', 'ModDate', 'Trapped']

/**
 * Turns pdf.js's `getMetadata()` result into findings in the same `{ id, label }` vocabulary
 * `inspect/imageMeta.js` uses: which Info dictionary fields are present, and whether an XMP
 * packet exists.
 */
export function summarizeDocumentMetadata(info, xmpMetadata) {
  const findings = []
  const presentFields = INFO_FIELDS.filter((f) => info && info[f] !== undefined && info[f] !== '')
  if (presentFields.length > 0) {
    findings.push({ id: 'pdf-info', label: `Document info (${presentFields.join(', ')})` })
  }
  if (xmpMetadata) {
    findings.push({ id: 'xmp', label: 'XMP metadata' })
  }
  return findings
}

/**
 * A page's annotation count and how many of those are form fields. pdf.js marks a Widget
 * (form field) annotation with a `fieldType` (the PDF spec's /FT entry — Tx, Btn, Ch or Sig);
 * no other annotation subtype carries one.
 */
export function summarizePageAnnotations(annotations) {
  return {
    annotationCount: annotations.length,
    formFieldCount: annotations.filter((a) => a.fieldType != null).length,
  }
}

/**
 * Whether a page's text content amounts to a real text layer — the line that explains why the
 * export loses selectable text. Ignores whitespace-only items, which some PDFs emit even with
 * nothing meaningful on the page to select.
 */
export function hasTextLayer(textContent) {
  return textContent.items.some((item) => item.str?.trim())
}

/**
 * Reads metadata from an already-open pdf.js document (SPEC.md build-order stage 7): the Info
 * dictionary fields present, whether an XMP packet exists, the attachment count, and per page
 * the annotation count, form-field count and whether a text layer exists.
 */
export async function pdfMeta(pdf) {
  const { info, metadata } = await pdf.getMetadata()
  const findings = summarizeDocumentMetadata(info, metadata)

  // Known limitation, confirmed against pdfjs-dist 6.3.289: pdf.getAttachments() returns an
  // empty result for embedded files even on a hand-built PDF whose /Names/EmbeddedFiles tree
  // matches pdf.js's own NameTree-parsing source exactly — verified against both a pikepdf-
  // generated attachment and a from-scratch one built directly to that source's expectations.
  // Doesn't compromise the guarantee (attachments are destroyed on export regardless, since
  // export/exportPdf.js builds a brand-new document that never carries any source object
  // across) — only this one inspection count can under-report until upstream fixes it.
  const attachments = await pdf.getAttachments()
  const attachmentCount = attachments ? Object.keys(attachments).length : 0

  const pages = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const [annotations, textContent] = await Promise.all([page.getAnnotations(), page.getTextContent()])
    pages.push({ ...summarizePageAnnotations(annotations), hasTextLayer: hasTextLayer(textContent) })
  }

  return { findings, attachmentCount, pages }
}
