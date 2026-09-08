import { describe, expect, it } from 'vitest'
import {
  HANDLES,
  clampPosition,
  clampRect,
  handlePoint,
  hitTestMarks,
  hitTestRect,
  isDegenerate,
  moveRect,
  normalizeRect,
  resizeRect,
} from '../../src/core/marks.js'

// Rect fields go through floating-point addition/subtraction, so comparing them with a plain
// toEqual risks a false failure from binary rounding (e.g. 0.4 - 0.1 !== 0.3 in JS). Every
// numeric field is compared with toBeCloseTo instead.
function expectRectCloseTo(actual, expected) {
  expect(actual.x).toBeCloseTo(expected.x)
  expect(actual.y).toBeCloseTo(expected.y)
  expect(actual.w).toBeCloseTo(expected.w)
  expect(actual.h).toBeCloseTo(expected.h)
}

describe('normalizeRect', () => {
  it('keeps a rect drawn top-left to bottom-right as-is', () => {
    expectRectCloseTo(normalizeRect(0.1, 0.2, 0.4, 0.5), { x: 0.1, y: 0.2, w: 0.3, h: 0.3 })
  })

  it('normalises a drag that goes up and to the left into a positive-width, top-left-origin rect', () => {
    // The whole point: a consumer should never see a negative width or height.
    expectRectCloseTo(normalizeRect(0.4, 0.5, 0.1, 0.2), { x: 0.1, y: 0.2, w: 0.3, h: 0.3 })
  })

  it('normalises a drag that only reverses on one axis', () => {
    expectRectCloseTo(normalizeRect(0.5, 0.2, 0.1, 0.4), { x: 0.1, y: 0.2, w: 0.4, h: 0.2 })
  })

  it('produces a zero-size rect for a click with no movement', () => {
    expectRectCloseTo(normalizeRect(0.3, 0.3, 0.3, 0.3), { x: 0.3, y: 0.3, w: 0, h: 0 })
  })
})

describe('clampRect', () => {
  it('leaves a rect that is already inside the page untouched', () => {
    expectRectCloseTo(clampRect({ x: 0.2, y: 0.2, w: 0.3, h: 0.3 }), { x: 0.2, y: 0.2, w: 0.3, h: 0.3 })
  })

  it('shrinks a rect whose far edge extends past the page, without moving its near edge', () => {
    const r = clampRect({ x: 0.9, y: 0.9, w: 0.3, h: 0.3 })
    expect(r.x).toBe(0.9)
    expect(r.y).toBe(0.9)
    expect(r.w).toBeCloseTo(0.1)
    expect(r.h).toBeCloseTo(0.1)
  })

  it('shrinks a rect whose near edge is negative, without moving its far edge', () => {
    const r = clampRect({ x: -0.2, y: -0.1, w: 0.4, h: 0.3 })
    expect(r.x).toBe(0)
    expect(r.y).toBe(0)
    expect(r.w).toBeCloseTo(0.2)
    expect(r.h).toBeCloseTo(0.2)
  })

  it('never returns a negative width or height for a rect entirely off the page', () => {
    const r = clampRect({ x: 1.5, y: 1.5, w: 0.2, h: 0.2 })
    expect(r.w).toBe(0)
    expect(r.h).toBe(0)
  })
})

describe('clampPosition', () => {
  it('leaves an in-bounds rect untouched', () => {
    expectRectCloseTo(clampPosition({ x: 0.2, y: 0.2, w: 0.3, h: 0.3 }), { x: 0.2, y: 0.2, w: 0.3, h: 0.3 })
  })

  it('stops a rect at the far edge without shrinking it', () => {
    const r = clampPosition({ x: 0.9, y: 0.9, w: 0.3, h: 0.3 })
    expect(r.x).toBeCloseTo(0.7)
    expect(r.y).toBeCloseTo(0.7)
    expect(r.w).toBe(0.3)
    expect(r.h).toBe(0.3)
  })

  it('stops a rect at the near edge without shrinking it', () => {
    const r = clampPosition({ x: -0.2, y: -0.1, w: 0.3, h: 0.3 })
    expect(r.x).toBe(0)
    expect(r.y).toBe(0)
    expect(r.w).toBe(0.3)
    expect(r.h).toBe(0.3)
  })
})

describe('moveRect', () => {
  it('translates a rect by a normalised delta, preserving its size', () => {
    expectRectCloseTo(moveRect({ x: 0.2, y: 0.3, w: 0.1, h: 0.15 }, 0.1, -0.05), { x: 0.3, y: 0.25, w: 0.1, h: 0.15 })
  })
})

describe('resizeRect', () => {
  const rect = { x: 0.2, y: 0.2, w: 0.4, h: 0.4 } // spans 0.2..0.6 on both axes

  it('dragging an edge handle changes only the dimension that edge controls', () => {
    // dy is passed but must be ignored: 'e' only touches the right edge.
    expectRectCloseTo(resizeRect(rect, 'e', 0.1, 0.5), { x: 0.2, y: 0.2, w: 0.5, h: 0.4 })
    // dx is passed but must be ignored: 's' only touches the bottom edge.
    expectRectCloseTo(resizeRect(rect, 's', 0.5, 0.1), { x: 0.2, y: 0.2, w: 0.4, h: 0.5 })
  })

  it('dragging a corner handle changes both dimensions from that corner', () => {
    expectRectCloseTo(resizeRect(rect, 'se', 0.1, -0.1), { x: 0.2, y: 0.2, w: 0.5, h: 0.3 })
  })

  it('dragging a handle past the opposite edge flips the rect instead of going negative', () => {
    // Dragging the east edge (at 0.6) left by 0.5 crosses the west edge (at 0.2).
    const r = resizeRect(rect, 'e', -0.5, 0)
    expect(r.w).toBeGreaterThanOrEqual(0)
    expectRectCloseTo(r, { x: 0.1, y: 0.2, w: 0.1, h: 0.4 })
  })
})

describe('hitTestRect / hitTestMarks', () => {
  const rect = { x: 0.2, y: 0.2, w: 0.2, h: 0.2 }

  it('is true for a point inside the rect, including its edges', () => {
    expect(hitTestRect(rect, { x: 0.3, y: 0.3 })).toBe(true)
    expect(hitTestRect(rect, { x: rect.x, y: rect.y })).toBe(true)
    expect(hitTestRect(rect, { x: rect.x + rect.w, y: rect.y + rect.h })).toBe(true)
  })

  it('is false for a point outside the rect', () => {
    expect(hitTestRect(rect, { x: 0.1, y: 0.1 })).toBe(false)
  })

  it('returns the topmost (last) mark when two marks overlap', () => {
    const marks = [
      { id: 'a', x: 0, y: 0, w: 0.5, h: 0.5 },
      { id: 'b', x: 0.1, y: 0.1, w: 0.5, h: 0.5 },
    ]
    expect(hitTestMarks(marks, { x: 0.3, y: 0.3 })).toBe(marks[1])
  })

  it('returns null when no mark is under the point', () => {
    const marks = [{ id: 'a', x: 0, y: 0, w: 0.2, h: 0.2 }]
    expect(hitTestMarks(marks, { x: 0.9, y: 0.9 })).toBe(null)
  })
})

describe('handlePoint', () => {
  const rect = { x: 0.2, y: 0.4, w: 0.2, h: 0.1 } // spans x 0.2..0.4, y 0.4..0.5

  it('places corner handles exactly on the corners', () => {
    const nw = handlePoint(rect, 'nw')
    expect(nw.x).toBeCloseTo(0.2)
    expect(nw.y).toBeCloseTo(0.4)
    const se = handlePoint(rect, 'se')
    expect(se.x).toBeCloseTo(0.4)
    expect(se.y).toBeCloseTo(0.5)
  })

  it('places edge handles at the midpoint of the edge they resize', () => {
    const n = handlePoint(rect, 'n')
    expect(n.x).toBeCloseTo(0.3)
    expect(n.y).toBeCloseTo(0.4)
    const e = handlePoint(rect, 'e')
    expect(e.x).toBeCloseTo(0.4)
    expect(e.y).toBeCloseTo(0.45)
  })

  it('covers every declared handle without throwing', () => {
    for (const handle of HANDLES) {
      expect(() => handlePoint(rect, handle)).not.toThrow()
    }
  })
})

describe('isDegenerate', () => {
  it('is true for a zero-size rect', () => {
    expect(isDegenerate({ x: 0, y: 0, w: 0, h: 0 })).toBe(true)
  })

  it('is false for a rect well above the minimum size', () => {
    expect(isDegenerate({ x: 0, y: 0, w: 0.1, h: 0.1 })).toBe(false)
  })
})
