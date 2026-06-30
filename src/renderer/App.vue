<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

import type { WindowKind } from '@shared/app-state'
import ControllerWindow from './components/ControllerWindow.vue'
import { getOnelineApi } from './electron-api'
import MainWindow from './components/MainWindow.vue'
import { useBrowserStore } from './stores/browser'

const browserStore = useBrowserStore()
let removeStateListener: (() => void) | null = null

/**
 * Reads the renderer role from Electron's load query.
 */
const getWindowKind = (): WindowKind => {
  const kind = new URLSearchParams(window.location.search).get('window')
  return kind === 'controller' ? 'controller' : 'main'
}

onMounted(async () => {
  browserStore.setWindowKind(getWindowKind())
  browserStore.hydrate(await getOnelineApi().getState())
  removeStateListener = getOnelineApi().onStateChanged((state) => browserStore.hydrate(state))
})

onUnmounted(() => {
  removeStateListener?.()
})
</script>

<template>
  <MainWindow v-if="browserStore.isReady && browserStore.windowKind === 'main'" />
  <ControllerWindow v-else-if="browserStore.isReady" />
</template>
