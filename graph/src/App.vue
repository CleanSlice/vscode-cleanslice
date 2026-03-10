<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import Loading from './components/common/Loading.vue'
import InitProvider from './components/init/Provider.vue'
import GraphProvider from './components/graph/Provider.vue'
import { vscode } from './vscode'

const projectInitialized = ref<boolean | null>(null)

function syncDarkMode() {
  const isDark = document.body.classList.contains('vscode-dark')
    || document.body.classList.contains('vscode-high-contrast')
  document.documentElement.classList.toggle('dark', isDark)
}

let observer: MutationObserver | undefined

onMounted(() => {
  syncDarkMode()

  observer = new MutationObserver(syncDarkMode)
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })

  window.addEventListener('message', (event) => {
    if (event.data.type === 'projectState') {
      projectInitialized.value = event.data.initialized
    }
  })
  vscode.postMessage({ type: 'webviewReady' })
})

onUnmounted(() => {
  observer?.disconnect()
})
</script>

<template>
  <Loading v-if="projectInitialized === null" />

  <InitProvider v-else-if="!projectInitialized" />

  <GraphProvider v-else />
</template>
