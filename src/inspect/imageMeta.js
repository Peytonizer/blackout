// Reads the first ~256 KB of an image file and reports which metadata segments/chunks are
// present — presence only, never a value. This file is about to be shared, so nothing found
// here gets rendered as anything more than "this was here and will be removed" (SPEC.md).
// Removal itself is automatic (re-encoding through a canvas strips all of it); this module
// exists purely so the removal summary can tell the truth about what was there.
const READ_WINDOW = 256 * 1024

function readAscii(view, offset, length) {
  if (offset < 0 || offset + length > view.byteLength) return ''
  let s = ''
  for (let i = 0; i < length; i++) s += String.fromCharCode(view.getUint8(offset + i))
  return s
}

// Within the EXIF IFD chain, notes whether a GPS IFD pointer (tag 0x8825) is present in IFD0,
// and whether IFD1 — where a JPEG thumbnail conventionally lives — carries one (tag 0x0201,
// JPEGInterchangeFormat). The embedded-thumbnail case is the one people miss: a "redacted"
// screenshot whose EXIF thumbnail still shows the original isn't redacted at all.
function scanExifIfds(view, tiffStart, tiffLength, findings) {
  if (tiffLength < 8) return
  const b0 = view.getUint8(tiffStart)
  const b1 = view.getUint8(tiffStart + 1)
  let little
  if (b0 === 0x49 && b1 === 0x49) little = true
  else if (b0 === 0x4d && b1 === 0x4d) little = false
  else return // not a recognisable TIFF byte-order mark

  const tiffEnd = tiffStart + tiffLength
  const u16 = (off) => view.getUint16(off, little)
  const u32 = (off) => view.getUint32(off, little)

  if (u16(tiffStart + 2) !== 0x2a) return // TIFF magic number

  const ifd0Offset = tiffStart + u32(tiffStart + 4)
  if (ifd0Offset + 2 > tiffEnd) return
  const ifd0Count = u16(ifd0Offset)

  let hasGps = false
  for (let i = 0; i < ifd0Count; i++) {
    const entryOffset = ifd0Offset + 2 + i * 12
    if (entryOffset + 12 > tiffEnd) break
    if (u16(entryOffset) === 0x8825) hasGps = true
  }
  if (hasGps) findings.set('gps', 'GPS location')

  const nextIfdField = ifd0Offset + 2 + ifd0Count * 12
  if (nextIfdField + 4 > tiffEnd) return
  const ifd1Rel = u32(nextIfdField)
  if (ifd1Rel === 0) return
  const ifd1Offset = tiffStart + ifd1Rel
  if (ifd1Offset + 2 > tiffEnd) return
  const ifd1Count = u16(ifd1Offset)
  for (let i = 0; i < ifd1Count; i++) {
    const entryOffset = ifd1Offset + 2 + i * 12
    if (entryOffset + 12 > tiffEnd) break
    if (u16(entryOffset) === 0x0201) {
      findings.set('thumbnail', 'Embedded thumbnail')
      break
    }
  }
}

// Walks JPEG marker segments from the SOI (FFD8), reporting the segments SPEC.md names, and
// stops at the Start of Scan (FFDA) — everything after that is entropy-coded image data, not
// more markers, and misreading compressed bytes as a marker would be a false positive.
function scanJpeg(view) {
  const findings = new Map()
  const len = view.byteLength
  let offset = 2
  while (offset + 1 < len) {
    if (view.getUint8(offset) !== 0xff) break
    const marker = view.getUint8(offset + 1)
    offset += 2
    // Markers with no length-prefixed payload: SOI/EOI and the restart markers.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
    if (marker === 0xd9) break // EOI
    if (offset + 2 > len) break
    const segmentLength = view.getUint16(offset)
    const payloadStart = offset + 2
    const payloadLength = segmentLength - 2
    if (payloadLength < 0 || payloadStart + payloadLength > len) break

    if (marker === 0xda) break // Start of Scan — entropy-coded data follows, stop here

    if (marker === 0xe1) {
      // APP1: EXIF or XMP, distinguished by their fixed ASCII prefix.
      if (readAscii(view, payloadStart, 6) === 'Exif\0\0') {
        findings.set('exif', 'EXIF metadata')
        scanExifIfds(view, payloadStart + 6, payloadLength - 6, findings)
      } else if (readAscii(view, payloadStart, 28) === 'http://ns.adobe.com/xap/1.0/') {
        findings.set('xmp', 'XMP metadata')
      }
    } else if (marker === 0xe2 && readAscii(view, payloadStart, 11) === 'ICC_PROFILE') {
      findings.set('icc', 'Colour profile (ICC)')
    } else if (marker === 0xed) {
      findings.set('iptc', 'IPTC/Photoshop data')
    } else if (marker === 0xfe) {
      findings.set('comment', 'Comment')
    }

    offset = payloadStart + payloadLength
  }
  return findings
}

// Walks PNG chunks from the 8-byte signature, reporting the ancillary chunk types SPEC.md
// names. tEXt/zTXt/iTXt collapse into one "text metadata" finding — they're the same kind of
// arbitrary key/value data to a reader, just different encodings.
function scanPng(view) {
  const findings = new Map()
  const textTypes = new Set(['tEXt', 'zTXt', 'iTXt'])
  const len = view.byteLength
  let offset = 8
  while (offset + 8 <= len) {
    const dataLength = view.getUint32(offset)
    const type = readAscii(view, offset + 4, 4)
    if (type === 'IEND') break
    if (textTypes.has(type)) findings.set('text', 'Text metadata')
    else if (type === 'eXIf') findings.set('exif', 'EXIF metadata')
    else if (type === 'iCCP') findings.set('icc', 'Colour profile (ICC)')
    else if (type === 'tIME') findings.set('timestamp', 'Modification timestamp')
    offset += 12 + dataLength // 4(length) + 4(type) + data + 4(CRC)
  }
  return findings
}

// Walks WebP's RIFF chunks, reporting the metadata chunks SPEC.md names. RIFF chunks are
// padded to an even length, hence the `+ (size % 2)`.
function scanWebp(view) {
  const findings = new Map()
  const len = view.byteLength
  let offset = 12 // 'RIFF' + size(4) + 'WEBP'
  while (offset + 8 <= len) {
    const fourCC = readAscii(view, offset, 4)
    const size = view.getUint32(offset + 4, true) // RIFF fields are little-endian
    if (fourCC === 'EXIF') findings.set('exif', 'EXIF metadata')
    else if (fourCC === 'XMP ') findings.set('xmp', 'XMP metadata')
    else if (fourCC === 'ICCP') findings.set('icc', 'Colour profile (ICC)')
    offset += 8 + size + (size % 2)
  }
  return findings
}

/**
 * Reads the first 256 KB of `file` and reports which metadata segments/chunks are present,
 * sniffing the container format from its magic bytes (not the caller's claimed MIME type).
 * Returns a list of `{ id, label }` findings — only entries that were actually found, in a
 * stable, human-readable vocabulary shared across formats (`exif`, `xmp`, `icc`, ... ) so
 * `inspect/summary.js` can merge them without caring which format they came from.
 */
export async function imageMeta(file) {
  const buffer = await file.slice(0, READ_WINDOW).arrayBuffer()
  const view = new DataView(buffer)

  let findings = new Map()
  if (view.byteLength >= 2 && view.getUint8(0) === 0xff && view.getUint8(1) === 0xd8) {
    findings = scanJpeg(view)
  } else if (view.byteLength >= 8 && readAscii(view, 0, 8) === '\x89PNG\r\n\x1a\n') {
    findings = scanPng(view)
  } else if (view.byteLength >= 12 && readAscii(view, 0, 4) === 'RIFF' && readAscii(view, 8, 4) === 'WEBP') {
    findings = scanWebp(view)
  }

  return [...findings].map(([id, label]) => ({ id, label }))
}
