const ACCEPTED_TYPES = new Map([
  ['image/png', 'PNG'],
  ['image/jpeg', 'JPEG'],
  ['image/webp', 'WebP'],
])

/**
 * Decodes a PNG/JPEG/WebP File/Blob into an ImageBitmap. The MIME type is checked before
 * decoding rather than left to `createImageBitmap` to fail on its own, so a rejected file gets
 * one clear message naming the accepted formats (SPEC.md build-order stage 2) instead of a
 * browser-specific decode error.
 *
 * `useDocument.js` routes a `application/pdf` file to `load/loadPdf.js` before this is ever
 * called, so PDF never reaches the check below — but it's still a format Blackout accepts
 * overall, so the rejection message for anything else names it alongside the image formats
 * this function actually handles, rather than implying PDF isn't supported at all.
 */
export async function loadImage(file) {
  if (!ACCEPTED_TYPES.has(file.type)) {
    throw new Error(`Unsupported file type. Blackout accepts ${[...ACCEPTED_TYPES.values()].join(', ')} images and PDF.`)
  }
  const bitmap = await createImageBitmap(file)
  return { bitmap, width: bitmap.width, height: bitmap.height }
}
