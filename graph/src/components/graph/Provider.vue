<script setup lang="ts">
import { ref, markRaw, onMounted, onUnmounted } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import type { Node, Edge } from '@vue-flow/core'
import { Plus, Minus, Maximize, Lock, Unlock, RefreshCw } from 'lucide-vue-next'
import NodeProvider from '../node/Provider.vue'
import HubProvider from '../node/HubProvider.vue'
import { vscode } from '../../vscode'
import { useGraphLayout } from './useGraphLayout'
import type { AppInfo, SliceInfo, EdgeInfo } from './types'

const nodeTypes = {
  slice: markRaw(NodeProvider),
  hub: markRaw(HubProvider),
}

const nodes = ref<Node[]>([])
const edges = ref<Edge[]>([])
const refreshing = ref(false)

const { onNodeClick, onNodeDragStart, onNodeDrag, fitView, zoomIn, zoomOut, nodesDraggable, findNode } = useVueFlow()
const { layout } = useGraphLayout()

// Hub-to-slice membership for group dragging
const hubSlices = new Map<string, string[]>()
let dragPrev: { x: number; y: number } | null = null

onNodeClick(({ node }) => {
  vscode.postMessage({ type: 'nodeSelected', slice: node.id })
})

onNodeDragStart(({ node }) => {
  if (node.type === 'hub') {
    dragPrev = { x: node.position.x, y: node.position.y }
  } else {
    dragPrev = null
  }
})

onNodeDrag(({ node }) => {
  if (node.type !== 'hub' || !dragPrev) return

  const dx = node.position.x - dragPrev.x
  const dy = node.position.y - dragPrev.y
  dragPrev = { x: node.position.x, y: node.position.y }

  const sliceIds = hubSlices.get(node.id) ?? []
  for (const id of sliceIds) {
    const n = findNode(id)
    if (n) {
      n.position = { x: n.position.x + dx, y: n.position.y + dy }
    }
  }
})

function refresh() {
  refreshing.value = true
  vscode.postMessage({ type: 'refresh' })
}

function applyModelData(apps: AppInfo[], slices: SliceInfo[], modelEdges: EdgeInfo[]) {
  const result = layout(apps, slices, modelEdges)
  nodes.value = result.nodes
  edges.value = result.edges

  // Build hub → slice membership for group dragging (includes subslices)
  hubSlices.clear()
  for (const n of result.nodes) {
    if (n.type !== 'hub') continue
    const directIds = result.edges
      .filter(e => e.source === n.id && e.id?.startsWith('spoke:'))
      .map(e => e.target!)
    const allIds = new Set(directIds)
    // Add subslices of direct children
    for (const e of result.edges) {
      if (e.id?.startsWith('sub:') && allIds.has(e.source!)) {
        allIds.add(e.target!)
      }
    }
    hubSlices.set(n.id, [...allIds])
  }

  setTimeout(() => fitView({ padding: 0.2 }), 50)
}

function onMessage(event: MessageEvent) {
  if (event.data.type === 'modelData') {
    refreshing.value = false
    applyModelData(event.data.apps, event.data.slices, event.data.edges)
  }
}

onMounted(() => {
  window.addEventListener('message', onMessage)
  // Request data — the initial modelData may have been sent before this component mounted
  vscode.postMessage({ type: 'refresh' })
})
onUnmounted(() => window.removeEventListener('message', onMessage))
</script>

<template>
  <div class="studio-graph">
    <VueFlow
      :nodes="nodes"
      :edges="edges"
      :node-types="(nodeTypes as any)"
      :default-edge-options="{ type: 'smoothstep' }"
      :min-zoom="0.05"
      :max-zoom="4"
      fit-view-on-init
      class="vue-flow"
    >
      <Background />
      <div class="controls">
        <button title="Zoom in" @click="zoomIn()">
          <Plus class="size-3.5" />
        </button>
        <button title="Zoom out" @click="zoomOut()">
          <Minus class="size-3.5" />
        </button>
        <button title="Fit view" @click="fitView({ padding: 0.2 })">
          <Maximize class="size-3.5" />
        </button>
        <button title="Toggle interactivity" @click="nodesDraggable = !nodesDraggable">
          <Unlock v-if="nodesDraggable" class="size-3.5" />
          <Lock v-else class="size-3.5" />
        </button>
        <button title="Refresh" :disabled="refreshing" @click="refresh">
          <RefreshCw class="size-3.5" :class="{ 'animate-spin': refreshing }" />
        </button>
      </div>
    </VueFlow>
  </div>
</template>

<style scoped>
.studio-graph {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.vue-flow {
  width: 100%;
  height: 100%;
}

.controls {
  position: absolute;
  bottom: 10px;
  left: 10px;
  display: flex;
  flex-direction: column;
  gap: 1px;
  background: var(--vscode-editorWidget-background, #1e1e2e);
  border: 1px solid var(--vscode-editorWidget-border, #2e2e3e);
  border-radius: 6px;
  overflow: hidden;
  z-index: 5;
}

.controls button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  color: var(--vscode-foreground, #cdd6f4);
  cursor: pointer;
}

.controls button:hover {
  background: var(--vscode-list-hoverBackground, #313244);
}

.controls button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
