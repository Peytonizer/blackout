import { describe, expect, it } from 'vitest'
import { renderRedacted } from '../../src/core/redact.js'

// jsdom has no canvas implementation, so this stands in for a real CanvasRenderingContext2D —
// it just records the calls renderRedacted makes, which is all there is to test here: the
// actual pixel-filling is a single browser API call (fillRect), verified by hand once at
// stage 4 (see the CHANGELOG). What's worth testing is that renderRedacted feeds it the right
// arguments, in the right order, using the outward-rounded device-pixel geometry.
function createMockCtx() {
  return {
    calls: [],
    fillStyle: null,
    drawImage(...args) {
      this.calls.push(['drawImage', args])
    },
    fillRect(...args) {
      this.calls.push(['fillRect', args])
    },
  }
}

describe('renderRedacted', () => {
  it('draws the raster once at full size before filling anything', () => {
    const ctx = createMockCtx()
    const raster = { fake: 'bitmap' }
    renderRedacted(ctx, raster, [], 200, 100)
    expect(ctx.calls).toEqual([['drawImage', [raster, 0, 0, 200, 100]]])
  })

  it('sets an opaque black fill style', () => {
    const ctx = createMockCtx()
    renderRedacted(ctx, {}, [{ x: 0.1, y: 0.1, w: 0.2, h: 0.2 }], 100, 100)
    expect(ctx.fillStyle).toBe('#000000')
  })

  it('fills one outward-rounded, device-pixel rect per mark, in order', () => {
    const ctx = createMockCtx()
    const marks = [
      // 0.1 + 0.2 is 0.30000000000000004 in floating point, not 0.3 — ceil pushes the right
      // edge to pixel 31, not 30. That's outward rounding doing exactly its job: a float
      // rounding error only ever grows the destroyed region, never shrinks it.
      { x: 0.1, y: 0.1, w: 0.2, h: 0.2 }, // -> 10,10 21x21
      { x: 0.5, y: 0.5, w: 0.3, h: 0.3 }, // -> 50,50 30x30
    ]
    renderRedacted(ctx, {}, marks, 100, 100)
    const fillCalls = ctx.calls.filter(([name]) => name === 'fillRect').map(([, args]) => args)
    expect(fillCalls).toEqual([
      [10, 10, 21, 21],
      [50, 50, 30, 30],
    ])
  })

  it('fills nothing when there are no marks', () => {
    const ctx = createMockCtx()
    renderRedacted(ctx, {}, [], 100, 100)
    expect(ctx.calls.filter(([name]) => name === 'fillRect')).toHaveLength(0)
  })
})
