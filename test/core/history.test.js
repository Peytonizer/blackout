import { describe, expect, it } from 'vitest'
import { canRedo, canUndo, commit, createHistory, redo, undo } from '../../src/core/history.js'

describe('history', () => {
  it('starts with no undo or redo available', () => {
    const h = createHistory([])
    expect(canUndo(h)).toBe(false)
    expect(canRedo(h)).toBe(false)
    expect(h.present).toEqual([])
  })

  it('commit moves the current state into the past and clears any redo branch', () => {
    let h = createHistory([])
    h = commit(h, ['a'])
    h = commit(h, ['a', 'b'])
    expect(h.present).toEqual(['a', 'b'])
    expect(canUndo(h)).toBe(true)
    expect(canRedo(h)).toBe(false)
  })

  it('undo steps back to the previous commit and enables redo', () => {
    let h = createHistory([])
    h = commit(h, ['a'])
    h = commit(h, ['a', 'b'])
    h = undo(h)
    expect(h.present).toEqual(['a'])
    expect(canRedo(h)).toBe(true)
  })

  it('redo re-applies an undone commit', () => {
    let h = createHistory([])
    h = commit(h, ['a'])
    h = commit(h, ['a', 'b'])
    h = undo(h)
    h = redo(h)
    expect(h.present).toEqual(['a', 'b'])
    expect(canRedo(h)).toBe(false)
  })

  it('is a no-op to undo with nothing in the past', () => {
    const h = createHistory(['a'])
    expect(undo(h)).toBe(h)
  })

  it('is a no-op to redo with nothing in the future', () => {
    const h = createHistory(['a'])
    expect(redo(h)).toBe(h)
  })

  it('a commit made after undoing drops the redo branch entirely', () => {
    let h = createHistory([])
    h = commit(h, ['a'])
    h = commit(h, ['a', 'b'])
    h = undo(h) // present: ['a'], future: [['a', 'b']]
    h = commit(h, ['a', 'c']) // a new branch — the ['a', 'b'] future is discarded
    expect(h.present).toEqual(['a', 'c'])
    expect(canRedo(h)).toBe(false)
  })

  it('can undo multiple times back to the initial state', () => {
    let h = createHistory([])
    h = commit(h, ['a'])
    h = commit(h, ['a', 'b'])
    h = undo(h)
    h = undo(h)
    expect(h.present).toEqual([])
    expect(canUndo(h)).toBe(false)
  })
})
