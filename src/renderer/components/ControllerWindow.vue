<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'

import type { HistoryEntry } from '@shared/app-state'
import { useBrowserStore } from '../stores/browser'

const browserStore = useBrowserStore()
const draftUrl = ref(browserStore.state.currentUrl)
const isEditing = ref(false)
const isUpdateBusy = computed(() =>
  ['checking', 'downloading'].includes(browserStore.state.update.phase)
)
const isUpdateButtonDisabled = computed(
  () => browserStore.state.update.phase === 'disabled' || isUpdateBusy.value
)
const updateButtonIcon = computed(() => {
  if (browserStore.state.update.phase === 'downloaded') {
    return 'mingcute:download-2-line'
  }

  if (isUpdateBusy.value) {
    return 'mingcute:refresh-2-line'
  }

  return 'mingcute:arrow-up-circle-line'
})
const updateButtonTitle = computed(() => {
  const { update } = browserStore.state

  if (update.phase === 'downloaded') {
    return `Install update ${update.availableVersion ?? ''}`.trim()
  }

  if (update.phase === 'downloading') {
    return update.percent === null ? 'Downloading update' : `Downloading update ${update.percent}%`
  }

  return update.message ?? 'Check for updates'
})
const sortedHistoryEntries = computed(() => browserStore.state.historyEntries)
const historyEmptyText = 'No history yet'

/**
 * Navigates to the current address field value.
 */
const submitUrl = async (): Promise<void> => {
  await browserStore.loadUrl(draftUrl.value)
  draftUrl.value = browserStore.state.currentUrl
}

/**
 * Hides the Controller window.
 */
const closeController = async (): Promise<void> => {
  await browserStore.setControllerVisible(false)
}

/**
 * Toggles the Controller history panel.
 */
const toggleHistory = async (): Promise<void> => {
  await browserStore.setHistoryVisible(!browserStore.state.historyVisible)
}

/**
 * Opens the selected history entry.
 */
const openHistoryEntry = async (entryId: string): Promise<void> => {
  await browserStore.openHistoryEntry(entryId)
}

/**
 * Checks for an update or installs an already downloaded update.
 */
const handleUpdateAction = async (): Promise<void> => {
  if (browserStore.state.update.phase === 'downloaded') {
    await browserStore.installUpdate()
    return
  }

  await browserStore.checkForUpdates()
}

watch(
  () => browserStore.state.currentUrl,
  (currentUrl) => {
    if (!isEditing.value) {
      draftUrl.value = currentUrl
    }
  }
)

onMounted(() => {
  draftUrl.value = browserStore.state.currentUrl
})

/**
 * Formats the hostname for compact history rows.
 */
const formatHistoryHost = (entry: HistoryEntry): string => {
  try {
    return new URL(entry.url).hostname || entry.url
  } catch {
    return entry.url
  }
}

/**
 * Formats the last visited timestamp for compact history rows.
 */
const formatHistoryTime = (entry: HistoryEntry): string =>
  new Intl.DateTimeFormat(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(entry.updatedAt))
</script>

<template>
  <section class="controller-shell">
    <form class="controller-toolbar" @submit.prevent="submitUrl">
      <div class="controller-grip" aria-hidden="true"></div>

      <button
        class="icon-button"
        type="button"
        title="Back"
        :disabled="!browserStore.state.canGoBack"
        @click="browserStore.goBack"
      >
        <Icon icon="mingcute:left-line" />
      </button>

      <button
        class="icon-button"
        type="button"
        title="Forward"
        :disabled="!browserStore.state.canGoForward"
        @click="browserStore.goForward"
      >
        <Icon icon="mingcute:right-line" />
      </button>

      <input
        v-model="draftUrl"
        class="url-input"
        spellcheck="false"
        autocomplete="off"
        aria-label="URL"
        @focus="isEditing = true"
        @blur="isEditing = false"
      />

      <button class="icon-button" type="submit" title="Go">
        <Icon icon="mingcute:arrow-right-circle-line" />
      </button>

      <button class="icon-button" type="button" title="Reload" @click="browserStore.reload">
        <Icon icon="mingcute:refresh-2-line" />
      </button>

      <button
        class="icon-button"
        :class="{ 'is-active': browserStore.state.historyVisible }"
        type="button"
        title="History"
        @click="toggleHistory"
      >
        <Icon icon="mingcute:history-line" />
      </button>

      <button
        class="icon-button"
        :class="{ 'is-active': browserStore.state.update.phase === 'downloaded' }"
        type="button"
        :title="updateButtonTitle"
        :disabled="isUpdateButtonDisabled"
        @click="handleUpdateAction"
      >
        <Icon :icon="updateButtonIcon" />
      </button>

      <button class="icon-button" type="button" title="Close" @click="closeController">
        <Icon icon="mingcute:close-line" />
      </button>

      <button class="icon-button danger" type="button" title="Quit" @click="browserStore.quit">
        <Icon icon="mingcute:power-line" />
      </button>
    </form>

    <div v-if="browserStore.state.historyVisible" class="history-panel">
      <ol v-if="sortedHistoryEntries.length > 0" class="history-list">
        <li v-for="entry in sortedHistoryEntries" :key="entry.id" class="history-row">
          <button class="history-item" type="button" @click="openHistoryEntry(entry.id)">
            <span class="history-title">{{ entry.title }}</span>
            <span class="history-time">{{ formatHistoryTime(entry) }}</span>
            <span class="history-meta">{{ formatHistoryHost(entry) }}</span>
            <span v-if="entry.selectedDom" class="history-selection">
              {{ entry.selectedDom.textPreview }}
            </span>
          </button>
        </li>
      </ol>
      <p v-else class="history-empty">
        {{ historyEmptyText }}
      </p>
    </div>
  </section>
</template>
