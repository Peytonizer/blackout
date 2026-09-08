import { describe, expect, it } from 'vitest'
import { imageMeta } from '../../src/inspect/imageMeta.js'

// Every fixture below is a hand-built byte array, not a real image — SPEC.md's testing note is
// explicit that fixtures are fabricated only, generated in code rather than committed as
// files. Nothing here needs to actually decode as a displayable image: imageMeta.js only ever
// walks marker/chunk structure, so a fixture just needs to be structurally valid.

function asciiBytes(str) {
  return [...str].map((c) => c.charCodeAt(0))
}
function be16(n) {
  return [(n >> 8) & 0xff, n & 0xff]
}
function be32(n) {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]
}
function le16(n) {
  return [n & 0xff, (n >> 8) & 0xff]
}
function le32(n) {
  return [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]
}

// --- JPEG ---

function jpegSegment(marker, payloadBytes) {
  return [0xff, marker, ...be16(payloadBytes.length + 2), ...payloadBytes]
}

function buildJpeg(segments = []) {
  const sos = [0xff, 0xda, ...be16(2)] // minimal Start of Scan — scanner stops here regardless of body
  return new Blob([new Uint8Array([0xff, 0xd8, ...segments.flat(), ...sos])])
}

// A minimal little-endian TIFF/EXIF block: IFD0 (optionally carrying a GPS pointer), then
// optionally an IFD1 (optionally carrying a thumbnail pointer).
function buildTiff({ gps = false, thumbnail = false } = {}) {
  const ifd0Entries = gps ? [[...le16(0x8825), ...le16(4), ...le32(1), ...le32(0)]] : []
  const ifd0ByteLength = 2 + ifd0Entries.length * 12 + 4
  const ifd1Offset = 8 + ifd0ByteLength
  const nextIfd = thumbnail ? ifd1Offset : 0
  const ifd0 = [...le16(ifd0Entries.length), ...ifd0Entries.flat(), ...le32(nextIfd)]

  const parts = [0x49, 0x49, ...le16(0x2a), ...le32(8), ...ifd0]
  if (thumbnail) {
    const ifd1Entries = [[...le16(0x0201), ...le16(4), ...le32(1), ...le32(0)]]
    const ifd1 = [...le16(ifd1Entries.length), ...ifd1Entries.flat(), ...le32(0)]
    parts.push(...ifd1)
  }
  return parts
}

// --- PNG ---

function pngChunk(type, dataBytes = []) {
  return [...be32(dataBytes.length), ...asciiBytes(type), ...dataBytes, 0, 0, 0, 0] // CRC unchecked by our scanner
}

function buildPng(chunks = []) {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  return new Blob([new Uint8Array([...sig, ...chunks.flat(), ...pngChunk('IEND')])])
}

// --- WebP ---

function riffChunk(fourCC, dataBytes = []) {
  const padded = dataBytes.length % 2 === 1 ? [...dataBytes, 0] : dataBytes
  return [...asciiBytes(fourCC), ...le32(dataBytes.length), ...padded]
}

function buildWebp(chunks = []) {
  const body = [...asciiBytes('WEBP'), ...chunks.flat()]
  return new Blob([new Uint8Array([...asciiBytes('RIFF'), ...le32(body.length), ...body])])
}

describe('imageMeta — JPEG', () => {
  it('finds nothing in a bare JPEG with no APPn segments', async () => {
    expect(await imageMeta(buildJpeg())).toEqual([])
  })

  it('reports EXIF, XMP, ICC, IPTC and a comment when each segment is present', async () => {
    const file = buildJpeg([
      jpegSegment(0xe1, [...asciiBytes('Exif'), 0, 0, ...buildTiff()]),
      jpegSegment(0xe1, asciiBytes('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta/>')),
      jpegSegment(0xe2, asciiBytes('ICC_PROFILE\0')),
      jpegSegment(0xed, asciiBytes('Photoshop 3.0')),
      jpegSegment(0xfe, asciiBytes('a comment')),
    ])
    const findings = await imageMeta(file)
    expect(findings.map((f) => f.id).sort()).toEqual(['comment', 'exif', 'icc', 'iptc', 'xmp'])
  })

  it('reports GPS presence from the EXIF IFD0 GPS pointer', async () => {
    const file = buildJpeg([jpegSegment(0xe1, [...asciiBytes('Exif'), 0, 0, ...buildTiff({ gps: true })])])
    const findings = await imageMeta(file)
    expect(findings.map((f) => f.id)).toContain('gps')
  })

  it('does not report GPS when the EXIF block has no GPS pointer', async () => {
    const file = buildJpeg([jpegSegment(0xe1, [...asciiBytes('Exif'), 0, 0, ...buildTiff({ gps: false })])])
    const findings = await imageMeta(file)
    expect(findings.map((f) => f.id)).not.toContain('gps')
  })

  it('reports an embedded thumbnail from IFD1, the case that matters most', async () => {
    const file = buildJpeg([jpegSegment(0xe1, [...asciiBytes('Exif'), 0, 0, ...buildTiff({ thumbnail: true })])])
    const findings = await imageMeta(file)
    expect(findings.map((f) => f.id)).toContain('thumbnail')
  })

  it('does not report a thumbnail when there is no IFD1', async () => {
    const file = buildJpeg([jpegSegment(0xe1, [...asciiBytes('Exif'), 0, 0, ...buildTiff({ thumbnail: false })])])
    const findings = await imageMeta(file)
    expect(findings.map((f) => f.id)).not.toContain('thumbnail')
  })

  it('stops at the Start of Scan and never misreads compressed data as a marker', async () => {
    // Entropy-coded data can legitimately contain the byte 0xFF followed by something that
    // isn't a real marker (JPEG stuffs a 0x00 after a literal 0xFF in the scan data for this
    // exact reason) — the scanner must not walk into it looking for more segments.
    const scanBytes = [0xff, 0x00, 0xaa, 0xbb, 0xff, 0xd9]
    const file = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xda, ...be16(2), ...scanBytes])])
    await expect(imageMeta(file)).resolves.toEqual([])
  })
})

describe('imageMeta — PNG', () => {
  it('finds nothing in a bare PNG with no ancillary chunks', async () => {
    expect(await imageMeta(buildPng())).toEqual([])
  })

  it('collapses tEXt/zTXt/iTXt into one text-metadata finding', async () => {
    const file = buildPng([pngChunk('tEXt', [...asciiBytes('Comment'), 0, ...asciiBytes('hello')])])
    const findings = await imageMeta(file)
    expect(findings).toEqual([{ id: 'text', label: 'Text metadata' }])
  })

  it('reports eXIf, iCCP and tIME as their own findings', async () => {
    const file = buildPng([pngChunk('eXIf', [1, 2, 3]), pngChunk('iCCP', [4, 5, 6]), pngChunk('tIME', [0, 0, 0, 0, 0, 0, 0])])
    const findings = await imageMeta(file)
    expect(findings.map((f) => f.id).sort()).toEqual(['exif', 'icc', 'timestamp'])
  })

  it('stops at IEND and does not read past it', async () => {
    const file = buildPng([pngChunk('tEXt', asciiBytes('x'))])
    await expect(imageMeta(file)).resolves.toEqual([{ id: 'text', label: 'Text metadata' }])
  })
})

describe('imageMeta — WebP', () => {
  it('finds nothing in a bare WebP with no metadata chunks', async () => {
    const file = buildWebp([riffChunk('VP8 ', [0, 1, 2, 3])])
    expect(await imageMeta(file)).toEqual([])
  })

  it('reports EXIF, XMP and ICC chunks', async () => {
    const file = buildWebp([riffChunk('EXIF', [1, 2, 3]), riffChunk('XMP ', [4, 5, 6, 7]), riffChunk('ICCP', [8])])
    const findings = await imageMeta(file)
    expect(findings.map((f) => f.id).sort()).toEqual(['exif', 'icc', 'xmp'])
  })

  it('advances past an odd-length chunk by its padding byte', async () => {
    // A 1-byte ICCP chunk is padded to 2 bytes on disk; if the scanner forgot the padding it
    // would misread the next chunk's header starting one byte early.
    const file = buildWebp([riffChunk('ICCP', [8]), riffChunk('EXIF', [1, 2])])
    const findings = await imageMeta(file)
    expect(findings.map((f) => f.id).sort()).toEqual(['exif', 'icc'])
  })
})

describe('imageMeta — unrecognised format', () => {
  it('returns no findings rather than throwing', async () => {
    const file = new Blob([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])])
    await expect(imageMeta(file)).resolves.toEqual([])
  })
})
