import { useState } from 'react'

/**
 * The password prompt for an encrypted PDF (SPEC.md's "Encrypted PDFs" decision: accepted,
 * pdf.js prompts, three wrong attempts then give up). `request` is `useDocument`'s
 * `passwordRequest` — `null` while nothing is being asked, otherwise `{ incorrect, attempt }`.
 * Submitting or cancelling resolves the promise `load/loadPdf.js`'s `onPassword` callback is
 * waiting on, letting pdf.js's own loading task continue or give up.
 */
export default function PdfPasswordPrompt({ request, onSubmit, onCancel }) {
  const [value, setValue] = useState('')
  if (!request) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 px-8">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit(value)
          setValue('')
        }}
        className="flex w-full max-w-sm flex-col gap-3 rounded border border-border bg-surface p-6"
      >
        <p className="font-mono text-[13px] text-text">This PDF is password-protected.</p>
        {request.incorrect && (
          <p className="font-mono text-[12px] text-accent">Incorrect password — attempt {request.attempt} of 3.</p>
        )}
        <input
          type="password"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Password"
          className="rounded-[3px] border border-border-soft bg-bg px-3 py-2 font-mono text-[13px] text-text placeholder:text-text-faintest"
        />
        <div className="flex justify-end gap-4 pt-1">
          <button
            type="button"
            onClick={() => {
              onCancel()
              setValue('')
            }}
            className="font-mono text-[12px] text-text-faint hover:text-text"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-[3px] bg-accent px-4 py-2 font-mono text-[12px] font-semibold text-bg hover:bg-accent-hover"
          >
            Unlock
          </button>
        </div>
      </form>
    </div>
  )
}
