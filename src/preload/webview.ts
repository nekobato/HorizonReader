import { ipcRenderer } from 'electron'

import type { ReadingRestoreState } from '@shared/app-state'
import {
  createDomSelection,
  findReadableCandidate,
  getElementLineHeight
} from '@shared/dom-selection'

const POSITION_REPORT_DELAY_MS = 350

let selectionMode = false
let selectedElement: Element | null = null
let hoverElement: Element | null = null
let positionReportTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Ensures the CSS used by selection mode is present in the embedded page.
 */
const ensureSelectionStyle = (): void => {
  if (document.getElementById('oneline-selection-style')) {
    return
  }

  const style = document.createElement('style')
  style.id = 'oneline-selection-style'
  style.textContent = `
    [data-oneline-hover="true"] {
      outline: 2px solid #2563eb !important;
      outline-offset: 2px !important;
      cursor: crosshair !important;
    }
    [data-oneline-selected="true"] {
      outline: 2px solid #0f766e !important;
      outline-offset: 2px !important;
    }
  `
  document.documentElement.append(style)
}

/**
 * Clears the temporary hover marker from the current candidate.
 */
const clearHoverElement = (): void => {
  hoverElement?.removeAttribute('data-oneline-hover')
  hoverElement = null
}

/**
 * Sets the selected marker on the current readable candidate.
 */
const setSelectedElement = (element: Element): void => {
  selectedElement?.removeAttribute('data-oneline-selected')
  selectedElement = element
  selectedElement.setAttribute('data-oneline-selected', 'true')
}

/**
 * Clears any existing readable target selection marker.
 */
const clearSelectedElement = (): void => {
  selectedElement?.removeAttribute('data-oneline-selected')
  selectedElement = null
}

/**
 * Enables or disables click-to-select mode in the embedded page.
 */
const setSelectionMode = (enabled: boolean): void => {
  selectionMode = enabled
  ensureSelectionStyle()

  if (!enabled) {
    clearHoverElement()
  }
}

/**
 * Returns true when keyboard input should stay inside an editable page element.
 */
const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return (
    target.isContentEditable ||
    target.matches('input, textarea, select') ||
    target.getAttribute('role') === 'textbox'
  )
}

/**
 * Reports the current page scroll offset to the host renderer.
 */
const reportReadingPosition = (): void => {
  ipcRenderer.sendToHost('oneline:reading-position', {
    url: window.location.href,
    scrollY: window.scrollY
  })
}

/**
 * Coalesces high-frequency page scroll events into fewer host messages.
 */
const scheduleReadingPositionReport = (): void => {
  if (positionReportTimer) {
    clearTimeout(positionReportTimer)
  }

  positionReportTimer = setTimeout(() => {
    positionReportTimer = null
    reportReadingPosition()
  }, POSITION_REPORT_DELAY_MS)
}

/**
 * Restores a selected readable DOM target and exact scroll offset.
 */
const restoreReadingState = (restore: ReadingRestoreState): void => {
  ensureSelectionStyle()
  clearSelectedElement()

  if (restore.selectedDom) {
    const restoredElement = document.querySelector(restore.selectedDom.selector)

    if (restoredElement) {
      setSelectedElement(restoredElement)
    }
  }

  requestAnimationFrame(() => {
    window.scrollTo({
      top: restore.scrollY,
      left: 0,
      behavior: 'instant'
    })
    reportReadingPosition()
    ipcRenderer.sendToHost('oneline:restore-applied')
  })
}

/**
 * Tracks the nearest readable element while selection mode is active.
 */
const handlePointerMove = (event: MouseEvent): void => {
  if (!selectionMode || !(event.target instanceof Element)) {
    return
  }

  const candidate = findReadableCandidate(event.target)

  if (candidate === hoverElement) {
    return
  }

  clearHoverElement()
  hoverElement = candidate
  candidate.setAttribute('data-oneline-hover', 'true')
}

/**
 * Selects a readable element, reports it to the host renderer, and scrolls it to the top.
 */
const handleClick = (event: MouseEvent): void => {
  if (!selectionMode || !(event.target instanceof Element)) {
    return
  }

  event.preventDefault()
  event.stopPropagation()

  const candidate = findReadableCandidate(event.target)
  const selection = createDomSelection(candidate)
  setSelectedElement(candidate)
  candidate.scrollIntoView({ block: 'start', inline: 'nearest' })
  setSelectionMode(false)
  ipcRenderer.sendToHost('oneline:dom-selected', selection)
  reportReadingPosition()
}

/**
 * Scrolls by exactly one selected line when the user presses arrow keys.
 */
const handleKeyDown = (event: KeyboardEvent): void => {
  if (!selectedElement || isEditableTarget(event.target)) {
    return
  }

  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
    return
  }

  event.preventDefault()
  const direction = event.key === 'ArrowDown' ? 1 : -1
  window.scrollBy({
    top: direction * getElementLineHeight(selectedElement),
    left: 0,
    behavior: 'instant'
  })
  scheduleReadingPositionReport()
}

ipcRenderer.on('oneline:set-selection-mode', (_event, enabled: boolean) =>
  setSelectionMode(Boolean(enabled))
)
ipcRenderer.on('oneline:restore-reading-state', (_event, restore: ReadingRestoreState) =>
  restoreReadingState(restore)
)

window.addEventListener('pointermove', handlePointerMove, true)
window.addEventListener('click', handleClick, true)
window.addEventListener('keydown', handleKeyDown, true)
window.addEventListener('scroll', scheduleReadingPositionReport, true)
window.addEventListener('beforeunload', () => {
  if (positionReportTimer) {
    clearTimeout(positionReportTimer)
    positionReportTimer = null
  }

  reportReadingPosition()
  selectedElement = null
  hoverElement = null
  selectionMode = false
})
