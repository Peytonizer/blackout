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
 */
export async function loadImage(file) {
  if (!ACCEPTED_TYPES.has(file.type)) {
    throw new Error(`Unsupported file type. Blackout accepts ${[...ACCEPTED_TYPES.values()].join(', ')} images.`)
  }
  const bitmap = await createImageBitmap(file)
  return { bitmap, width: bitmap.width, height: bitmap.height }
}
