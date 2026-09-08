/**
 * Merges per-page mark counts and format-specific metadata findings into the removal-summary
 * model `RemovalSummary` renders (SPEC.md feature 4). PDF-only fields (attachments,
 * annotations, form fields, whether a text layer exists) stay `null` until `inspect/pdfMeta.js`
 * folds them in at build-order stage 7.
 */
export function buildSummary(pages, metadataFindings) {
  return {
    pages: pages.map((p) => ({ id: p.id, markCount: p.marks.length })),
    metadata: metadataFindings,
    attachments: null,
    annotations: null,
    hasTextLayer: null,
  }
}
