/**
 * Derives the export filename from the source's — same base name, a `-redacted` marker, and
 * `extension` (default `png`: SPEC.md's decisions table says image export is always PNG,
 * regardless of the source format; PDF export passes `'pdf'`). `photo.jpg` ->
 * `photo-redacted.png`; a name with no extension (or a leading dot only, like `.hidden`) is
 * used as-is before the marker is appended.
 */
export function redactedFilename(sourceFilename, extension = 'png') {
  const dot = sourceFilename.lastIndexOf('.')
  const base = dot > 0 ? sourceFilename.slice(0, dot) : sourceFilename
  return `${base}-redacted.${extension}`
}

/**
 * Triggers a browser download of `blob` as `filename` via a transient object URL and a
 * synthetic `<a download>` click — no server round-trip, no navigating away from the page.
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
