export const MIN_MAIN_HEIGHT = 28
export const MAX_MAIN_HEIGHT = 96
export const DEFAULT_MAIN_HEIGHT = 72
export const DEFAULT_LINE_HEIGHT = 24

const LINE_HEIGHT_RATIO = 1.2

/**
 * Keeps a numeric value inside an inclusive range.
 */
export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

/**
 * Parses computed CSS line-height into pixels, including the browser's `normal` keyword.
 */
export const parseComputedLineHeight = (lineHeight: string, fontSize: string): number => {
  const parsedLineHeight = Number.parseFloat(lineHeight)

  if (Number.isFinite(parsedLineHeight)) {
    return parsedLineHeight
  }

  const parsedFontSize = Number.parseFloat(fontSize)
  return Number.isFinite(parsedFontSize) ? parsedFontSize * LINE_HEIGHT_RATIO : DEFAULT_LINE_HEIGHT
}

/**
 * Converts a selected DOM line-height to a usable Main window height.
 */
export const coerceMainHeight = (lineHeight: number): number => {
  if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
    return DEFAULT_MAIN_HEIGHT
  }

  return Math.round(clamp(Math.ceil(lineHeight), MIN_MAIN_HEIGHT, MAX_MAIN_HEIGHT))
}
