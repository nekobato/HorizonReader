import { DEFAULT_LINE_HEIGHT, parseComputedLineHeight } from './line-height'
import type { DomSelection } from './app-state'

const READABLE_SELECTOR =
  'p, li, blockquote, pre, h1, h2, h3, h4, h5, h6, article, section, main, [role="article"]'
const MIN_TEXT_LENGTH = 12

/**
 * Escapes one CSS selector segment without depending on browser support for CSS.escape.
 */
export const escapeCssIdentifier = (value: string): string =>
  value.replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`)

/**
 * Builds a stable-enough selector for an element inside arbitrary web content.
 */
export const buildElementSelector = (element: Element): string => {
  const id = element.getAttribute('id')

  if (id) {
    return `#${escapeCssIdentifier(id)}`
  }

  const segments: string[] = []
  let current: Element | null = element

  while (
    current &&
    current.nodeType === Node.ELEMENT_NODE &&
    current.tagName.toLowerCase() !== 'html'
  ) {
    const tagName = current.tagName.toLowerCase()
    const parent: Element | null = current.parentElement

    if (!parent) {
      segments.unshift(tagName)
      break
    }

    const sameTagSiblings = Array.from(parent.children as HTMLCollectionOf<Element>).filter(
      (sibling) => sibling.tagName.toLowerCase() === tagName
    )
    const segment =
      sameTagSiblings.length > 1
        ? `${tagName}:nth-of-type(${sameTagSiblings.indexOf(current) + 1})`
        : tagName

    segments.unshift(segment)
    current = parent
  }

  return segments.join(' > ')
}

/**
 * Chooses a readable block-like candidate from a clicked DOM element.
 */
export const findReadableCandidate = (startElement: Element): Element => {
  const preferred = startElement.closest(READABLE_SELECTOR)

  if (preferred && (preferred.textContent?.trim().length ?? 0) >= MIN_TEXT_LENGTH) {
    return preferred
  }

  let current: Element | null = startElement

  while (current?.parentElement) {
    const textLength = current.textContent?.trim().length ?? 0

    if (textLength >= MIN_TEXT_LENGTH) {
      return current
    }

    current = current.parentElement
  }

  return startElement
}

/**
 * Calculates the rendered line-height for a DOM element.
 */
export const getElementLineHeight = (element: Element): number => {
  const ownerWindow = element.ownerDocument.defaultView

  if (!ownerWindow) {
    return DEFAULT_LINE_HEIGHT
  }

  const style = ownerWindow.getComputedStyle(element)
  return parseComputedLineHeight(style.lineHeight, style.fontSize)
}

/**
 * Creates the payload sent from the embedded page when a DOM target is selected.
 */
export const createDomSelection = (element: Element): DomSelection => ({
  selector: buildElementSelector(element),
  tagName: element.tagName.toLowerCase(),
  textPreview: element.textContent?.replace(/\s+/g, ' ').trim().slice(0, 120) ?? '',
  lineHeight: getElementLineHeight(element)
})
