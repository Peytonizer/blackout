import { describe, expect, it } from 'vitest'
import { toDevicePixels, toNormalizedPoint, toScreenPoint, toScreenRect } from '../../src/core/units.js'

describe('toDevicePixels', () => {
  it('rounds a mark that already sits on whole pixels to those same pixels', () => {
    expect(toDevicePixels({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 }, 100, 100)).toEqual({ x: 25, y: 25, w: 50, h: 50 })
  })

  it('rounds outward rather than to nearest, so a sub-pixel edge never leaves a sliver of the original', () => {
    // At width 100, the left edge sits at pixel 25.1 — flooring keeps pixel 25 inside the
    // destroyed region rather than rounding it away. The right edge at 74.9 ceils to 75.
    const r = toDevicePixels({ x: 0.251, y: 0.251, w: 0.498, h: 0.498 }, 100, 100)
    expect(r.x).toBe(25)
    expect(r.y).toBe(25)
    expect(r.x + r.w).toBe(75)
    expect(r.y + r.h).toBe(75)
  })

  it('clamps a mark that extends past the far edge of the canvas', () => {
    const r = toDevicePixels({ x: 0.9, y: 0.9, w: 0.3, h: 0.3 }, 100, 100) // far edge at 1.2
    expect(r.x).toBe(90)
    expect(r.y).toBe(90)
    expect(r.x + r.w).toBe(100)
    expect(r.y + r.h).toBe(100)
  })

  it('clamps a mark whose origin is negative to zero', () => {
    const r = toDevicePixels({ x: -0.1, y: -0.1, w: 0.2, h: 0.2 }, 100, 100)
    expect(r.x).toBe(0)
    expect(r.y).toBe(0)
  })

  it('produces a zero-size result, not a negative one, for a zero-size mark', () => {
    const r = toDevicePixels({ x: 0.5, y: 0.5, w: 0, h: 0 }, 100, 100)
    expect(r.w).toBe(0)
    expect(r.h).toBe(0)
  })

  it('never returns a negative width or height, even for a vanishingly thin mark', () => {
    // A near-zero mark can have its floored left edge land past its ceiled right edge;
    // Math.max(0, ...) is what stops that becoming a negative width.
    const r = toDevicePixels({ x: 0.30001, y: 0.30001, w: 0.00002, h: 0.00002 }, 100, 100)
    expect(r.w).toBeGreaterThanOrEqual(0)
    expect(r.h).toBeGreaterThanOrEqual(0)
  })

  it('produces a zero-size result for a mark entirely off the canvas', () => {
    const r = toDevicePixels({ x: 1.5, y: 1.5, w: 0.2, h: 0.2 }, 100, 100)
    expect(r.w).toBe(0)
    expect(r.h).toBe(0)
  })
})

describe('toScreenPoint / toScreenRect / toNormalizedPoint', () => {
  const naturalWidth = 400
  const naturalHeight = 300
  const containerSize = { width: 800, height: 600 }

  it('centres the page origin in the container at scale 1 with no offset', () => {
    const p = toScreenPoint({ x: 0, y: 0 }, naturalWidth, naturalHeight, containerSize, 1, { x: 0, y: 0 })
    expect(p).toEqual({ x: 200, y: 150 })
  })

  it('sizes a full-page mark to the natural size at scale 1', () => {
    const rect = toScreenRect({ x: 0, y: 0, w: 1, h: 1 }, naturalWidth, naturalHeight, containerSize, 1, { x: 0, y: 0 })
    expect(rect).toEqual({ x: 200, y: 150, w: 400, h: 300 })
  })

  it('applies scale and offset the same way PageCanvas draws the raster', () => {
    const p = toScreenPoint({ x: 0.5, y: 0.5 }, naturalWidth, naturalHeight, containerSize, 2, { x: 10, y: -5 })
    // drawWidth/Height = 800/600, drawX/Y = (800-800)/2+10=10, (600-600)/2-5=-5
    // point at 0.5,0.5 -> drawX + 0.5*drawWidth = 10 + 400 = 410; drawY + 300 = 295
    expect(p).toEqual({ x: 410, y: 295 })
  })

  it('is the exact inverse of toScreenPoint for the page origin', () => {
    const screen = toScreenPoint({ x: 0, y: 0 }, naturalWidth, naturalHeight, containerSize, 1, { x: 0, y: 0 })
    const back = toNormalizedPoint(screen, naturalWidth, naturalHeight, containerSize, 1, { x: 0, y: 0 })
    expect(back.x).toBeCloseTo(0)
    expect(back.y).toBeCloseTo(0)
  })

  it('round-trips an arbitrary point through toScreenPoint and back under pan and zoom', () => {
    const scale = 2.5
    const offset = { x: 40, y: -20 }
    const original = { x: 0.3, y: 0.6 }
    const screen = toScreenPoint(original, naturalWidth, naturalHeight, containerSize, scale, offset)
    const back = toNormalizedPoint(screen, naturalWidth, naturalHeight, containerSize, scale, offset)
    expect(back.x).toBeCloseTo(original.x)
    expect(back.y).toBeCloseTo(original.y)
  })
})
