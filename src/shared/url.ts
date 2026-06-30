const DEFAULT_HOME_URL = 'https://example.com/'
const SEARCH_BASE_URL = 'https://duckduckgo.com/?q='
const EXPLICIT_PROTOCOL_PATTERN = /^[a-zA-Z][a-zA-Z\d+\-.]*:/
const HOST_LIKE_PATTERN =
  /^(localhost|\d{1,3}(?:\.\d{1,3}){3}|\[[0-9a-fA-F:]+\]|[^/\s]+\.[^/\s]+)(:\d+)?(\/.*)?$/

/**
 * Returns the default page used when the user submits an empty address.
 */
export const getDefaultHomeUrl = (): string => DEFAULT_HOME_URL

/**
 * Converts address-bar input into a navigable URL.
 */
export const normalizeNavigationInput = (rawInput: string): string => {
  const input = rawInput.trim()

  if (input.length === 0) {
    return DEFAULT_HOME_URL
  }

  if (input === 'about:blank') {
    return input
  }

  if (HOST_LIKE_PATTERN.test(input)) {
    const protocol =
      input.startsWith('localhost') || input.startsWith('127.') ? 'http://' : 'https://'
    return new URL(`${protocol}${input}`).toString()
  }

  if (EXPLICIT_PROTOCOL_PATTERN.test(input)) {
    const parsed = new URL(input)
    return parsed.toString()
  }

  return `${SEARCH_BASE_URL}${encodeURIComponent(input)}`
}
