import { describe, expect, it } from 'vitest'

import {
  DEFAULT_MAIN_HEIGHT,
  MAX_MAIN_HEIGHT,
  MIN_MAIN_HEIGHT,
  coerceMainHeight,
  parseComputedLineHeight
} from './line-height'

describe('parseComputedLineHeight', () => {
  it('uses numeric CSS line-height values as pixels', () => {
    expect(parseComputedLineHeight('32px', '16px')).toBe(32)
  })

  it('estimates normal line-height from font size', () => {
    expect(parseComputedLineHeight('normal', '20px')).toBe(24)
  })
})

describe('coerceMainHeight', () => {
  it('falls back for invalid line-height values', () => {
    expect(coerceMainHeight(Number.NaN)).toBe(DEFAULT_MAIN_HEIGHT)
  })

  it('keeps the window usable for small text', () => {
    expect(coerceMainHeight(16)).toBe(MIN_MAIN_HEIGHT)
  })

  it('caps very large line-height values', () => {
    expect(coerceMainHeight(240)).toBe(MAX_MAIN_HEIGHT)
  })
})
