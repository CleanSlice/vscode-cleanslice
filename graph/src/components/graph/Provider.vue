<script setup lang="ts">
import { ref, markRaw, onMounted, onUnmounted } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import type { Node, Edge } from '@vue-flow/core'
import { Plus, Minus, Maximize, Lock, Unlock, RefreshCw } from 'lucide-vue-next'
import NodeProvider from '../node/Provider.vue'
import { vscode } from '../../vscode'

interface SliceInfo {
  name: string
  path: string
  fileCount: number
  type: 'setup' | 'feature'
  parent: string | null
  subsliceCount: number
}

interface EdgeInfo {
  from: string
  to: string
  count: number
}

const nodeTypes = {
  slice: markRaw(NodeProvider),
}

const nodes = ref<Node[]>([])
const edges = ref<Edge[]>([])
const refreshing = ref(false)

const { onNodeClick, fitView, zoomIn, zoomOut, nodesDraggable } = useVueFlow()

onNodeClick(({ node }) => {
  vscode.postMessage({ type: 'nodeSelected', slice: node.id })
})

function refresh() {
  refreshing.value = true
  vscode.postMessage({ type: 'refresh' })
}

function applyModelData(slices: SliceInfo[], modelEdges: EdgeInfo[]) {
  // Count dependencies per slice
  const depsOut = new Map<string, number>()
  const depsIn = new Map<string, number>()
  for (const e of modelEdges) {
    depsOut.set(e.from, (depsOut.get(e.from) ?? 0) + 1)
    depsIn.set(e.to, (depsIn.get(e.to) ?? 0) + 1)
  }

  // Separate top-level slices from subslices
  const topLevel = slices.filter(s => s.parent === null)
  const subsByParent = new Map<string, SliceInfo[]>()
  for (const s of slices) {
    if (s.parent !== null) {
      const list = subsByParent.get(s.parent) ?? []
      list.push(s)
      subsByParent.set(s.parent, list)
    }
  }

  const setupSlices = topLevel.filter(s => s.type === 'setup')
  const featureSlices = topLevel.filter(s => s.type === 'feature')

  const COL_GAP = 320
  const ROW_GAP = 120
  const SUB_X_OFFSET = 230
  const SUB_ROW_GAP = 90
  const START_X = 50
  const START_Y = 50

  const newNodes: Node[] = []
  const newEdges: Edge[] = []

  function buildNode(s: SliceInfo, x: number, y: number, isSubslice = false) {
    newNodes.push({
      id: s.name,
      type: 'slice',
      position: { x, y },
      data: {
        label: s.name,
        type: s.type,
        fileCount: s.fileCount,
        subsliceCount: s.subsliceCount,
        isSubslice,
        depsIn: depsIn.get(s.name) ?? 0,
        depsOut: depsOut.get(s.name) ?? 0,
      },
    })
  }

  /** Place a top-level slice and its subslices. Returns the total vertical space consumed. */
  function placeSliceWithSubs(s: SliceInfo, x: number, y: number): number {
    buildNode(s, x, y)
    const subs = subsByParent.get(s.name) ?? []

    for (let i = 0; i < subs.length; i++) {
      const subY = y + (i + 1) * SUB_ROW_GAP
      buildNode(subs[i], x + SUB_X_OFFSET, subY, true)

      // Parent → subslice edge
      newEdges.push({
        id: `sub:${s.name}-${subs[i].name}`,
        source: s.name,
        target: subs[i].name,
        type: 'smoothstep',
        animated: false,
        style: { strokeDasharray: '6 3', strokeWidth: 1.5, stroke: 'var(--color-muted-foreground)' },
      })
    }

    // Vertical space: parent row + subslice rows
    const subHeight = subs.length * SUB_ROW_GAP
    return Math.max(ROW_GAP, subHeight + ROW_GAP)
  }

  let setupY = START_Y
  for (const s of setupSlices) {
    setupY += placeSliceWithSubs(s, START_X, setupY)
  }

  let featureY = START_Y
  for (const s of featureSlices) {
    featureY += placeSliceWithSubs(s, START_X + COL_GAP, featureY)
  }

  // Dependency edges
  for (const e of modelEdges) {
    newEdges.push({
      id: `dep:${e.from}-${e.to}`,
      source: e.from,
      target: e.to,
      animated: e.count >= 3,
      label: String(e.count),
    })
  }

  nodes.value = newNodes
  edges.value = newEdges

  setTimeout(() => fitView({ padding: 0.2 }), 50)
}

function onMessage(event: MessageEvent) {
  if (event.data.type === 'modelData') {
    refreshing.value = false
    applyModelData(event.data.slices, event.data.edges)
  }
}

onMounted(() => window.addEventListener('message', onMessage))
onUnmounted(() => window.removeEventListener('message', onMessage))
</script>

<template>
  <div class="studio-graph">
    <VueFlow
      :nodes="nodes"
      :edges="edges"
      :node-types="(nodeTypes as any)"
      :default-edge-options="{ type: 'smoothstep' }"
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
