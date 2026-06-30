import { describe, expect, it } from 'vitest'

import type { DomSelection, HistoryEntry } from './app-state'
import {
  normalizeHistoryTitle,
  normalizeScrollY,
  recordHistoryPosition,
  recordHistorySelection,
  recordHistoryVisit
} from './history'

const selection: DomSelection = {
  selector: '#novel_honbun',
  tagName: 'div',
  textPreview: 'Readable chapter text.',
  lineHeight: 28
}

/**
 * Creates a deterministic history entry for helper tests.
 */
const createEntry = (url: string, title = url): HistoryEntry => ({
  id: `entry-${url}`,
  url,
  title,
  visitedAt: '2026-05-08T00:00:00.000Z',
  updatedAt: '2026-05-08T00:00:00.000Z',
  selectedDom: null,
  scrollY: 0
})

describe('normalizeScrollY', () => {
  it('rounds valid scroll offsets and rejects invalid values', () => {
    expect(normalizeScrollY(42.6)).toBe(43)
    expect(normalizeScrollY(-10)).toBe(0)
    expect(normalizeScrollY(Number.NaN)).toBe(0)
  })
})

describe('normalizeHistoryTitle', () => {
  it('falls back to the URL for blank page titles', () => {
    expect(normalizeHistoryTitle('  ', 'https://example.com/')).toBe('https://example.com/')
  })
})

describe('recordHistoryVisit', () => {
  it('adds new visits to the front of history', () => {
    const entries = recordHistoryVisit([createEntry('https://old.example/')], {
      id: 'new',
      url: 'https://new.example/',
      title: 'New page',
      visitedAt: '2026-05-08T01:00:00.000Z'
    })

    expect(entries.map((entry) => entry.url)).toEqual([
      'https://new.example/',
      'https://old.example/'
    ])
  })

  it('deduplicates exact URLs while preserving reading state', () => {
    const existing: HistoryEntry = {
      ...createEntry('https://example.com/chapter'),
      selectedDom: selection,
      scrollY: 120
    }
    const entries = recordHistoryVisit([existing], {
      id: 'ignored',
      url: existing.url,
      title: 'Updated title',
      visitedAt: '2026-05-08T02:00:00.000Z'
    })

    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      id: existing.id,
      title: 'Updated title',
      selectedDom: selection,
      scrollY: 120
    })
  })

  it('limits history length', () => {
    const entries = recordHistoryVisit(
      [createEntry('https://a.test/'), createEntry('https://b.test/')],
      {
        id: 'c',
        url: 'https://c.test/',
        title: 'C',
        visitedAt: '2026-05-08T03:00:00.000Z'
      },
      2
    )

    expect(entries.map((entry) => entry.url)).toEqual(['https://c.test/', 'https://a.test/'])
  })
})

describe('recordHistorySelection', () => {
  it('stores selected DOM metadata for the matching URL', () => {
    const [entry] = recordHistorySelection([createEntry('https://example.com/')], {
      url: 'https://example.com/',
      selectedDom: selection,
      updatedAt: '2026-05-08T04:00:00.000Z'
    })

    expect(entry.selectedDom).toEqual(selection)
    expect(entry.updatedAt).toBe('2026-05-08T04:00:00.000Z')
  })
})

describe('recordHistoryPosition', () => {
  it('stores scroll position for the matching URL', () => {
    const [entry] = recordHistoryPosition(
      [createEntry('https://example.com/')],
      { url: 'https://example.com/', scrollY: 88.8 },
      '2026-05-08T05:00:00.000Z'
    )

    expect(entry.scrollY).toBe(89)
    expect(entry.updatedAt).toBe('2026-05-08T05:00:00.000Z')
  })
})
