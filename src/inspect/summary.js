/**
 * Merges per-page mark counts and format-specific metadata findings into the removal-summary
 * model `RemovalSummary` renders (SPEC.md feature 4). `attachmentCount`, and each page's
 * `annotationCount`/`formFieldCount`/`hasTextLayer`, come from `inspect/pdfMeta.js` and are
 * only ever present for a PDF — an image's pages carry none of them, so the corresponding
 * summary fields stay `null` rather than claiming a false zero.
 */
export function buildSummary(pages, metadataFindings, attachmentCount = null) {
  const hasAnnotationData = pages.some((p) => p.annotationCount !== undefined)
  const hasTextLayerData = pages.some((p) => p.hasTextLayer !== undefined)

  return {
    pages: pages.map((p) => ({ id: p.id, markCount: p.marks.length })),
    metadata: metadataFindings,
    attachments: attachmentCount,
    annotations: hasAnnotationData ? pages.reduce((sum, p) => sum + (p.annotationCount ?? 0), 0) : null,
    formFields: hasAnnotationData ? pages.reduce((sum, p) => sum + (p.formFieldCount ?? 0), 0) : null,
    hasTextLayer: hasTextLayerData ? pages.some((p) => p.hasTextLayer) : null,
  }
}
