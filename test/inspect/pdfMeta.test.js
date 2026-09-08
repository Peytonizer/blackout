import { describe, expect, it } from 'vitest'
import { hasTextLayer, summarizeDocumentMetadata, summarizePageAnnotations } from '../../src/inspect/pdfMeta.js'

describe('summarizeDocumentMetadata', () => {
  it('finds nothing for an empty Info dictionary and no XMP', () => {
    expect(summarizeDocumentMetadata({}, null)).toEqual([])
  })

  it('names the Info fields that are actually present', () => {
    const findings = summarizeDocumentMetadata({ Title: 'Q3 Report', Author: 'someone', Keywords: '' }, null)
    expect(findings).toHaveLength(1)
    expect(findings[0].id).toBe('pdf-info')
    // Keywords is present as a key but empty, so it's not named; Title and Author are.
    expect(findings[0].label).toContain('Title')
    expect(findings[0].label).toContain('Author')
    expect(findings[0].label).not.toContain('Keywords')
  })

  it('ignores fields pdf.js adds that are not real Info dictionary entries', () => {
    const findings = summarizeDocumentMetadata({ IsAcroFormPresent: true, PDFFormatVersion: '1.7' }, null)
    expect(findings).toEqual([])
  })

  it('reports XMP presence separately from Info dictionary fields', () => {
    const findings = summarizeDocumentMetadata({}, { fake: 'xmp metadata object' })
    expect(findings).toEqual([{ id: 'xmp', label: 'XMP metadata' }])
  })

  it('reports both when both are present', () => {
    const findings = summarizeDocumentMetadata({ Producer: 'Acrobat' }, {})
    expect(findings.map((f) => f.id).sort()).toEqual(['pdf-info', 'xmp'])
  })
})

describe('summarizePageAnnotations', () => {
  it('counts zero annotations on a page with none', () => {
    expect(summarizePageAnnotations([])).toEqual({ annotationCount: 0, formFieldCount: 0 })
  })

  it('counts annotations and separately counts how many are form fields', () => {
    const annotations = [
      { subtype: 'Link' },
      { subtype: 'Widget', fieldType: 'Tx' },
      { subtype: 'Widget', fieldType: 'Btn' },
      { subtype: 'Highlight' },
    ]
    expect(summarizePageAnnotations(annotations)).toEqual({ annotationCount: 4, formFieldCount: 2 })
  })

  it('does not count a non-widget annotation as a form field even if it has other fields', () => {
    const annotations = [{ subtype: 'Text', contents: 'a note' }]
    expect(summarizePageAnnotations(annotations)).toEqual({ annotationCount: 1, formFieldCount: 0 })
  })
})

describe('hasTextLayer', () => {
  it('is false for a page with no text items at all', () => {
    expect(hasTextLayer({ items: [] })).toBe(false)
  })

  it('is false for a page whose text items are all whitespace', () => {
    expect(hasTextLayer({ items: [{ str: ' ' }, { str: '\n' }, { str: '' }] })).toBe(false)
  })

  it('is true when at least one text item has real content', () => {
    expect(hasTextLayer({ items: [{ str: ' ' }, { str: 'Hello' }] })).toBe(true)
  })
})
