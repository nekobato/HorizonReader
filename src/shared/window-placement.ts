import { clamp } from './line-height'

/**
 * Rectangle coordinates used for Electron window placement.
 */
export interface RectangleLike {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/**
 * Pixel size used for the fixed Controller window.
 */
export interface WindowSize {
  readonly width: number
  readonly height: number
}

/**
 * Calculates the Controller position beside the larger vertical gap around Main.
 */
export const calculateControllerPlacement = (
  mainBounds: RectangleLike,
  controllerSize: WindowSize,
  workArea: RectangleLike,
  gap = 8
): RectangleLike => {
  const aboveSpace = mainBounds.y - workArea.y
  const belowSpace = workArea.y + workArea.height - (mainBounds.y + mainBounds.height)
  const shouldPlaceAbove = aboveSpace > belowSpace
  const rawY = shouldPlaceAbove
    ? mainBounds.y - controllerSize.height - gap
    : mainBounds.y + mainBounds.height + gap

  const alignedRightX = mainBounds.x + mainBounds.width - controllerSize.width
  const x = Math.round(
    clamp(alignedRightX, workArea.x, workArea.x + workArea.width - controllerSize.width)
  )
  const y = Math.round(
    clamp(rawY, workArea.y, workArea.y + workArea.height - controllerSize.height)
  )

  return {
    x,
    y,
    width: controllerSize.width,
    height: controllerSize.height
  }
}
