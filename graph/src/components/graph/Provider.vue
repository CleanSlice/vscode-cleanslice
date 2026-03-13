<script setup lang="ts">
import { ref, markRaw, onMounted, onUnmounted } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import type { Node, Edge } from '@vue-flow/core'
import { Plus, Minus, Maximize, Lock, Unlock, RefreshCw, Users, X } from 'lucide-vue-next'
import ClaudeIcon from '../node/ClaudeIcon.vue'
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
const teamSlices = ref(new Set<string>())

const { onNodeClick, onNodeDragStart, onNodeDrag, onNodeMouseEnter, onNodeMouseLeave, fitView, zoomIn, zoomOut, nodesDraggable, findNode, getNodes, getEdges, updateNode, updateNodeData } = useVueFlow()
const { layout } = useGraphLayout()

// Store original edge styles so we can restore them
import type { CSSProperties } from 'vue'
const edgeStyleCache = new Map<string, CSSProperties>()

onNodeMouseEnter(({ node }) => {
  applyHighlight(node.id)
})

onNodeMouseLeave(() => {
  clearHighlight()
})

function getConnectedIds(nodeId: string) {
  const connectedNodeIds = new Set<string>([nodeId])
  const connectedEdgeIds = new Set<string>()

  for (const edge of getEdges.value) {
    if (edge.source === nodeId || edge.target === nodeId) {
      connectedEdgeIds.add(edge.id)
      connectedNodeIds.add(edge.source)
      connectedNodeIds.add(edge.target)
    }
  }

  // Also include subslices if hovering a parent
  const subs = parentChildren.get(nodeId)
  if (subs) {
    for (const id of subs) connectedNodeIds.add(id)
  }

  return { connectedNodeIds, connectedEdgeIds }
}

function applyHighlight(nodeId: string) {
  const { connectedNodeIds, connectedEdgeIds } = getConnectedIds(nodeId)

  for (const node of getNodes.value) {
    const isConnected = connectedNodeIds.has(node.id)
    updateNode(node.id, { style: { opacity: isConnected ? 1 : 0.15 } })
    updateNodeData(node.id, { glow: node.id === nodeId })
  }
  for (const edge of getEdges.value) {
    if (!edgeStyleCache.has(edge.id)) {
      edgeStyleCache.set(edge.id, { ...(edge.style as CSSProperties ?? {}) })
    }
    const original = edgeStyleCache.get(edge.id)!
    edge.style = connectedEdgeIds.has(edge.id)
      ? { ...original, opacity: 1 }
      : { ...original, opacity: 0.08 }
  }
}

function clearHighlight() {
  for (const node of getNodes.value) {
    updateNode(node.id, { style: { opacity: 1 } })
    updateNodeData(node.id, { glow: false })
  }
  for (const edge of getEdges.value) {
    const original = edgeStyleCache.get(edge.id)
    if (original) {
      edge.style = { ...original }
    }
  }
}

// Group dragging: hub → all slices, parent slice → subslices, subslice → itself
const hubChildren = new Map<string, string[]>()
const parentChildren = new Map<string, string[]>()
let dragNodeId: string | null = null
let dragPrev: { x: number; y: number } | null = null

onNodeClick(({ node }) => {
  vscode.postMessage({ type: 'nodeSelected', slice: node.id })
})

onNodeDragStart(({ node }) => {
  dragNodeId = node.id
  dragPrev = { x: node.position.x, y: node.position.y }
})

onNodeDrag(({ node }) => {
  if (!dragPrev || node.id !== dragNodeId) return

  const dx = node.position.x - dragPrev.x
  const dy = node.position.y - dragPrev.y
  dragPrev = { x: node.position.x, y: node.position.y }

  let childIds: string[] = []
  if (node.type === 'hub') {
    childIds = hubChildren.get(node.id) ?? []
  } else if (parentChildren.has(node.id)) {
    childIds = parentChildren.get(node.id)!
  }

  for (const id of childIds) {
    const n = findNode(id)
    if (n) {
      n.position = { x: n.position.x + dx, y: n.position.y + dy }
    }
  }
})

function toggleTeamSlice(slicePath: string) {
  if (teamSlices.value.has(slicePath)) {
    teamSlices.value.delete(slicePath)
  } else {
    teamSlices.value.add(slicePath)
  }
  // Update node data to reflect selection
  for (const node of getNodes.value) {
    if (node.data?.path === slicePath) {
      updateNodeData(node.id, { teamSelected: teamSlices.value.has(slicePath) })
      break
    }
  }
}

function launchTeam() {
  if (teamSlices.value.size === 0) return
  vscode.postMessage({ type: 'launchTeam', slices: [...teamSlices.value] })
  // Clear selection
  for (const path of teamSlices.value) {
    for (const node of getNodes.value) {
      if (node.data?.path === path) {
        updateNodeData(node.id, { teamSelected: false })
        break
      }
    }
  }
  teamSlices.value.clear()
}

function clearTeam() {
  for (const path of teamSlices.value) {
    for (const node of getNodes.value) {
      if (node.data?.path === path) {
        updateNodeData(node.id, { teamSelected: false })
        break
      }
    }
  }
  teamSlices.value.clear()
}

function refresh() {
  refreshing.value = true
  vscode.postMessage({ type: 'refresh' })
}

function applyModelData(apps: AppInfo[], slices: SliceInfo[], modelEdges: EdgeInfo[]) {
  const result = layout(apps, slices, modelEdges)
  nodes.value = result.nodes
  edges.value = result.edges

  // Build group dragging maps
  hubChildren.clear()
  parentChildren.clear()

  // Parent → subslice relationships from sub: edges
  for (const e of result.edges) {
    if (e.id?.startsWith('sub:')) {
      const list = parentChildren.get(e.source!) ?? []
      list.push(e.target!)
      parentChildren.set(e.source!, list)
    }
  }

  // Hub → all slices (parent slices + their subslices)
  for (const n of result.nodes) {
    if (n.type !== 'slice') continue
    const appName = n.id.split(':')[0]
    const hubId = `hub:${appName}`
    const list = hubChildren.get(hubId) ?? []
    list.push(n.id)
    hubChildren.set(hubId, list)
  }

  setTimeout(() => fitView({ padding: 0.2 }), 50)
}

function onMessage(event: MessageEvent) {
  if (event.data.type === 'modelData') {
    refreshing.value = false
    applyModelData(event.data.apps, event.data.slices, event.data.edges)
  } else if (event.data.type === 'claudeState') {
    // Find the node by matching the path in node data
    for (const node of getNodes.value) {
      if (node.data?.path === event.data.slice) {
        updateNodeData(node.id, { claudeActive: event.data.active })
        break
      }
    }
  }
}

// Listen for toggleTeamSlice messages from node components (they go via vscode.postMessage)
// We need to intercept these before they reach the extension host
const origPostMessage = vscode.postMessage.bind(vscode)
vscode.postMessage = (msg: any) => {
  if (msg.type === 'toggleTeamSlice') {
    toggleTeamSlice(msg.slice)
    return
  }
  origPostMessage(msg)
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
      <div v-if="teamSlices.size > 0" class="team-bar">
        <ClaudeIcon class="size-3.5" style="color: #CC7C5E" />
        <span class="team-count">{{ teamSlices.size }} slice{{ teamSlices.size > 1 ? 's' : '' }}</span>
        <button class="team-launch" title="Launch agent team" @click="launchTeam">
          <Users class="size-3" />
          Launch Team
        </button>
        <button class="team-clear" title="Clear selection" @click="clearTeam">
          <X class="size-3" />
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

.team-bar {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--vscode-editorWidget-background, #1e1e2e);
  border: 1px solid rgba(204, 124, 94, 0.4);
  border-radius: 8px;
  z-index: 5;
  color: var(--vscode-foreground, #cdd6f4);
  font-size: 12px;
}

.team-count {
  opacity: 0.7;
}

.team-launch {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  background: rgba(204, 124, 94, 0.2);
  border: 1px solid rgba(204, 124, 94, 0.4);
  border-radius: 4px;
  color: #CC7C5E;
  font-size: 11px;
  cursor: pointer;
}

.team-launch:hover {
  background: rgba(204, 124, 94, 0.35);
}

.team-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background: transparent;
  border: none;
  color: var(--vscode-foreground, #cdd6f4);
  opacity: 0.5;
  cursor: pointer;
}

.team-clear:hover {
  opacity: 1;
}
</style>
