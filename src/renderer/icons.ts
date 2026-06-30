import mingcuteIcons from '@iconify-json/mingcute/icons.json'
import { addCollection } from '@iconify/vue'

/**
 * Registers local icon data so Electron renderer windows do not need Iconify API access.
 */
export const registerIcons = (): void => {
  addCollection(mingcuteIcons)
}
