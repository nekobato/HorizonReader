import { describe, expect, it } from 'vitest'

import { buildElementSelector, createDomSelection, findReadableCandidate } from './dom-selection'

describe('buildElementSelector', () => {
  it('uses an element id when present', () => {
    document.body.innerHTML = '<article id="entry.one"><p>Text</p></article>'
    const article = document.querySelector('article')

    expect(article ? buildElementSelector(article) : '').toBe('#entry\\.one')
  })

  it('uses nth-of-type for sibling elements', () => {
    document.body.innerHTML = '<main><p>First paragraph</p><p>Second paragraph</p></main>'
    const paragraph = document.querySelectorAll('p').item(1)

    expect(buildElementSelector(paragraph)).toBe('body > main > p:nth-of-type(2)')
  })
})

describe('findReadableCandidate', () => {
  it('prefers a readable parent paragraph', () => {
    document.body.innerHTML = '<p>Readable text with <span>nested content</span>.</p>'
    const span = document.querySelector('span')

    expect(span ? findReadableCandidate(span).tagName : '').toBe('P')
  })
})

describe('createDomSelection', () => {
  it('summarizes selected DOM element text', () => {
    document.body.innerHTML = '<p style="line-height: 30px">Readable text with spacing.</p>'
    const paragraph = document.querySelector('p')

    expect(paragraph ? createDomSelection(paragraph).lineHeight : 0).toBe(30)
    expect(paragraph ? createDomSelection(paragraph).textPreview : '').toBe(
      'Readable text with spacing.'
    )
  })
})
