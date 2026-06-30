import { describe, expect, it } from 'vitest'

import { getDefaultHomeUrl, normalizeNavigationInput } from './url'

describe('normalizeNavigationInput', () => {
  it('returns the default home page for blank input', () => {
    expect(normalizeNavigationInput('  ')).toBe(getDefaultHomeUrl())
  })

  it('keeps explicit https URLs', () => {
    expect(normalizeNavigationInput('https://example.com/path?q=1')).toBe(
      'https://example.com/path?q=1'
    )
  })

  it('adds https to domain-like input', () => {
    expect(normalizeNavigationInput('example.com/posts')).toBe('https://example.com/posts')
  })

  it('adds http to localhost input', () => {
    expect(normalizeNavigationInput('localhost:5173')).toBe('http://localhost:5173/')
  })

  it('turns plain text into a search query', () => {
    expect(normalizeNavigationInput('吾輩は猫である')).toBe(
      'https://duckduckgo.com/?q=%E5%90%BE%E8%BC%A9%E3%81%AF%E7%8C%AB%E3%81%A7%E3%81%82%E3%82%8B'
    )
  })
})
