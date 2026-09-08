/**
 * The pre-export warning contract for a PDF (SPEC.md build-order stage 9): before the
 * irreversible export runs, states plainly what it costs. Every line here is a real PDF-export
 * cost from SPEC.md's decisions table — an image export has none of them (same pixels, PNG
 * out, nothing lost), so this panel never appears for one.
 */
export default function ExportPanel({ open, hasTextLayer, wasEncrypted, onConfirm, onCancel }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 px-8">
      <div className="flex w-full max-w-md flex-col gap-4 rounded border border-border bg-surface p-6">
        <p className="font-mono text-[13px] text-text">Before you export:</p>
        <ul className="flex flex-col gap-2 font-mono text-[12px] text-text-faint">
          <li>
            <span className="text-accent">·</span> Every page is rebuilt as a picture — the file
            gets larger, sometimes considerably.
          </li>
          {hasTextLayer && (
            <li>
              <span className="text-accent">·</span> Selectable text is lost. The output is an
              image of the document, not a text document.
            </li>
          )}
          {wasEncrypted && (
            <li>
              <span className="text-accent">·</span> The source needed a password; the exported
              file won't — re-protect it yourself if that matters.
            </li>
          )}
          <li>
            <span className="text-accent">·</span> There's no undo after this. The source file on
            disk is never touched.
          </li>
        </ul>
        <div className="flex justify-end gap-4 pt-1">
          <button type="button" onClick={onCancel} className="font-mono text-[12px] text-text-faint hover:text-text">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-[3px] bg-accent px-4 py-2 font-mono text-[12px] font-semibold text-bg hover:bg-accent-hover"
          >
            Export anyway
          </button>
        </div>
      </div>
    </div>
  )
}
