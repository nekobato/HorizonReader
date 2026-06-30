import type { DomSelection, HistoryEntry, ReadingPosition } from './app-state'

export const MAX_HISTORY_ENTRIES = 100

export interface HistoryVisitInput {
  readonly id: string
  readonly url: string
  readonly title: string
  readonly visitedAt: string
}

export interface HistorySelectionInput {
  readonly url: string
  readonly selectedDom: DomSelection
  readonly updatedAt: string
}

/**
 * Normalizes scroll offsets from renderer/webview events before persistence.
 */
export const normalizeScrollY = (scrollY: number): number =>
  Number.isFinite(scrollY) && scrollY > 0 ? Math.round(scrollY) : 0

/**
 * Keeps readable history titles useful even before the page title is available.
 */
export const normalizeHistoryTitle = (title: string, url: string): string => {
  const trimmedTitle = title.trim()
  return trimmedTitle.length > 0 ? trimmedTitle : url
}

/**
 * Inserts or refreshes a history entry while keeping exact URLs unique.
 */
export const recordHistoryVisit = (
  entries: readonly HistoryEntry[],
  input: HistoryVisitInput,
  maxEntries = MAX_HISTORY_ENTRIES
): readonly HistoryEntry[] => {
  const existing = entries.find((entry) => entry.url === input.url)
  const nextEntry: HistoryEntry = {
    id: existing?.id ?? input.id,
    url: input.url,
    title: normalizeHistoryTitle(input.title, input.url),
    visitedAt: existing?.visitedAt ?? input.visitedAt,
    updatedAt: input.visitedAt,
    selectedDom: existing?.selectedDom ?? null,
    scrollY: existing?.scrollY ?? 0
  }

  return [nextEntry, ...entries.filter((entry) => entry.url !== input.url)].slice(
    0,
    Math.max(1, maxEntries)
  )
}

/**
 * Stores the selected readable DOM target for an existing or current history entry.
 */
export const recordHistorySelection = (
  entries: readonly HistoryEntry[],
  input: HistorySelectionInput
): readonly HistoryEntry[] =>
  entries.map((entry) =>
    entry.url === input.url
      ? {
          ...entry,
          selectedDom: input.selectedDom,
          scrollY: normalizeScrollY(entry.scrollY),
          updatedAt: input.updatedAt
        }
      : entry
  )

/**
 * Stores the latest scroll position for a visited URL.
 */
export const recordHistoryPosition = (
  entries: readonly HistoryEntry[],
  position: ReadingPosition,
  updatedAt: string
): readonly HistoryEntry[] =>
  entries.map((entry) =>
    entry.url === position.url
      ? {
          ...entry,
          scrollY: normalizeScrollY(position.scrollY),
          updatedAt
        }
      : entry
  )
