/**
 * Lists everything the export will remove: marks and metadata found in the source file
 * (SPEC.md feature 4) — makes the export a deliberate act, and doubles as the answer to "did
 * it actually work". Presence only, never a metadata *value*: this file is about to be shared,
 * so nothing found here is rendered as more than a label naming what was found.
 *
 * `attachments`, `annotations`, `formFields` and `hasTextLayer` are `null` for an image
 * (SPEC.md's PDF-only inspection fields, from `inspect/pdfMeta.js`) and only rendered when
 * they're actually present, so a document with none of them doesn't clutter this line.
 */
export default function RemovalSummary({ inspection }) {
  const totalMarks = inspection.pages.reduce((sum, p) => sum + p.markCount, 0)

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-border bg-surface px-8 py-2 font-mono text-[11px] text-text-faint max-[900px]:px-8 min-[901px]:px-[72px]">
      <span>
        <span className="text-text">{totalMarks}</span> mark{totalMarks === 1 ? '' : 's'} will
        destroy the covered pixels
      </span>
      {inspection.metadata.length > 0 ? (
        <span>
          <span className="text-text">{inspection.metadata.length}</span> metadata field
          {inspection.metadata.length === 1 ? '' : 's'} will be removed:{' '}
          {inspection.metadata.map((f) => f.label).join(', ')}
        </span>
      ) : (
        <span>No metadata found in this file</span>
      )}
      {!!inspection.attachments && (
        <span>
          <span className="text-text">{inspection.attachments}</span> attachment
          {inspection.attachments === 1 ? '' : 's'} will be removed
        </span>
      )}
      {!!inspection.annotations && (
        <span>
          <span className="text-text">{inspection.annotations}</span> annotation
          {inspection.annotations === 1 ? '' : 's'} will be removed
          {inspection.formFields > 0 &&
            ` (${inspection.formFields} form field${inspection.formFields === 1 ? '' : 's'})`}
        </span>
      )}
      {inspection.hasTextLayer && <span className="text-accent">Selectable text will be lost on export</span>}
    </div>
  )
}
