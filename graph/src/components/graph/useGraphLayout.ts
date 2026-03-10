import type { Node, Edge } from '@vue-flow/core'
import type { AppInfo, SliceInfo, EdgeInfo } from './types'

// ---------------------------------------------------------------------------
//  Constants
// ---------------------------------------------------------------------------

const SLICE_WIDTH = 200
const SLICE_HEIGHT = 80
const SUB_SLICE_WIDTH = 160
const SUB_ROW_GAP = 10
const HUB_WIDTH = 280
const HUB_HEIGHT = 120
const MIN_RADIUS = 250
const SLICE_PAD = 20
const CLUSTER_GAP = 200

interface LayoutResult {
  nodes: Node[]
  edges: Edge[]
}

// ---------------------------------------------------------------------------
//  Composable
// ---------------------------------------------------------------------------

export function useGraphLayout() {
  function layout(apps: AppInfo[], slices: SliceInfo[], modelEdges: EdgeInfo[]): LayoutResult {
    const depsIn = countDeps(modelEdges, 'to')
    const depsOut = countDeps(modelEdges, 'from')
    const subsByParent = groupSubslices(slices)
    const appGroups = groupByApp(slices)
    const appMeta = new Map(apps.map(a => [a.name, a]))

    const nodes: Node[] = []
    const edges: Edge[] = []

    let hubX = 0

    for (const appName of [...appGroups.keys()].sort()) {
      const group = appGroups.get(appName)!
      const app = appMeta.get(appName)
      const topLevel = [...group.setup, ...group.feature]
      const maxSubCount = Math.max(0, ...topLevel.map(s => subsByParent.get(s.name)?.length ?? 0))

      const radius = computeRadius(topLevel.length, maxSubCount)
      const boundingR = clusterBoundingRadius(radius, maxSubCount)
      const cx = hubX + boundingR
      const cy = 0

      // Hub node
      nodes.push(buildHubNode(appName, cx, cy, app))

      // Setup slices — left semicircle (π/2 → 3π/2)
      const setupAngles = distributeOnArc(group.setup.length, Math.PI / 2, (3 * Math.PI) / 2)
      for (let i = 0; i < group.setup.length; i++) {
        placeSlice(group.setup[i], cx, cy, radius, setupAngles[i], subsByParent, depsIn, depsOut, nodes, edges)
      }

      // Feature slices — right semicircle (-π/2 → π/2)
      const featureAngles = distributeOnArc(group.feature.length, -Math.PI / 2, Math.PI / 2)
      for (let i = 0; i < group.feature.length; i++) {
        placeSlice(group.feature[i], cx, cy, radius, featureAngles[i], subsByParent, depsIn, depsOut, nodes, edges)
      }

      // Spoke edges (hub → slices)
      for (const s of topLevel) {
        edges.push({
          id: `spoke:${appName}-${s.name}`,
          source: `hub:${appName}`,
          target: s.name,
          type: 'smoothstep',
          animated: false,
          style: { stroke: 'var(--color-border)', strokeWidth: 1, opacity: 0.25 },
        })
      }

      hubX = cx + boundingR + CLUSTER_GAP
    }

    layoutDependencyEdges(modelEdges, edges)
    return { nodes, edges }
  }

  return { layout }
}

// ---------------------------------------------------------------------------
//  Grouping helpers
// ---------------------------------------------------------------------------

function countDeps(edges: EdgeInfo[], field: 'from' | 'to'): Map<string, number> {
  const map = new Map<string, number>()
  for (const e of edges) {
    map.set(e[field], (map.get(e[field]) ?? 0) + 1)
  }
  return map
}

function groupSubslices(slices: SliceInfo[]): Map<string, SliceInfo[]> {
  const map = new Map<string, SliceInfo[]>()
  for (const s of slices) {
    if (s.parent !== null) {
      const list = map.get(s.parent) ?? []
      list.push(s)
      map.set(s.parent, list)
    }
  }
  return map
}

function groupByApp(slices: SliceInfo[]): Map<string, { setup: SliceInfo[]; feature: SliceInfo[] }> {
  const map = new Map<string, { setup: SliceInfo[]; feature: SliceInfo[] }>()
  for (const s of slices) {
    if (s.parent !== null) continue
    if (!map.has(s.app)) map.set(s.app, { setup: [], feature: [] })
    map.get(s.app)![s.type].push(s)
  }
  return map
}

// ---------------------------------------------------------------------------
//  Radial math
// ---------------------------------------------------------------------------

function columnHeight(subCount: number): number {
  return SLICE_HEIGHT + subCount * (SLICE_HEIGHT + SUB_ROW_GAP)
}

function computeRadius(sliceCount: number, maxSubCount: number): number {
  if (sliceCount <= 2) return MIN_RADIUS
  // The tallest column determines the minimum chord between adjacent positions
  const tallest = Math.max(columnHeight(maxSubCount), SLICE_HEIGHT)
  const minChord = Math.max(Math.sqrt(SLICE_WIDTH ** 2 + tallest ** 2), SLICE_WIDTH) + SLICE_PAD
  const r = minChord / (2 * Math.sin(Math.PI / sliceCount))
  return Math.max(r, MIN_RADIUS)
}

function clusterBoundingRadius(radius: number, maxSubCount: number): number {
  const verticalExtent = columnHeight(maxSubCount) / 2
  const extent = Math.max(SLICE_WIDTH / 2, verticalExtent)
  return radius + extent + 40
}

function distributeOnArc(count: number, startAngle: number, endAngle: number): number[] {
  if (count === 0) return []
  if (count === 1) return [(startAngle + endAngle) / 2]
  const step = (endAngle - startAngle) / (count + 1)
  return Array.from({ length: count }, (_, i) => startAngle + step * (i + 1))
}

// ---------------------------------------------------------------------------
//  Node builders
// ---------------------------------------------------------------------------

function buildHubNode(appName: string, cx: number, cy: number, app?: AppInfo): Node {
  return {
    id: `hub:${appName}`,
    type: 'hub',
    position: { x: cx - HUB_WIDTH / 2, y: cy - HUB_HEIGHT / 2 },
    data: {
      label: appName,
      appType: appName === 'api' ? 'api' : 'frontend',
      techStack: app?.techStack ?? [],
      swaggerUrl: app?.swaggerUrl,
      sliceCount: app?.sliceCount ?? 0,
    },
  }
}

function buildSliceNode(
  s: SliceInfo,
  x: number,
  y: number,
  depsIn: Map<string, number>,
  depsOut: Map<string, number>,
  isSubslice = false,
): Node {
  const width = isSubslice ? SUB_SLICE_WIDTH : SLICE_WIDTH
  return {
    id: s.name,
    type: 'slice',
    position: { x: x - width / 2, y: y - SLICE_HEIGHT / 2 },
    data: {
      label: s.name,
      type: s.type,
      fileCount: s.fileCount,
      subsliceCount: s.subsliceCount,
      isSubslice,
      depsIn: depsIn.get(s.name) ?? 0,
      depsOut: depsOut.get(s.name) ?? 0,
    },
  }
}

// ---------------------------------------------------------------------------
//  Placement
// ---------------------------------------------------------------------------

function placeSlice(
  s: SliceInfo,
  cx: number,
  cy: number,
  radius: number,
  angle: number,
  subsByParent: Map<string, SliceInfo[]>,
  depsIn: Map<string, number>,
  depsOut: Map<string, number>,
  nodes: Node[],
  edges: Edge[],
): void {
  const x = cx + radius * Math.cos(angle)
  const y = cy + radius * Math.sin(angle)
  nodes.push(buildSliceNode(s, x, y, depsIn, depsOut))

  // Subslices — stacked in a column below parent
  const subs = subsByParent.get(s.name) ?? []
  for (let i = 0; i < subs.length; i++) {
    const sy = y + (i + 1) * (SLICE_HEIGHT + SUB_ROW_GAP)
    nodes.push(buildSliceNode(subs[i], x, sy, depsIn, depsOut, true))

    edges.push({
      id: `sub:${s.name}-${subs[i].name}`,
      source: s.name,
      sourceHandle: 'source-left',
      target: subs[i].name,
      targetHandle: 'target-left',
      type: 'smoothstep',
      animated: false,
      style: { strokeDasharray: '6 3', strokeWidth: 1.5, stroke: 'var(--color-muted-foreground)' },
    })
  }
}

function layoutDependencyEdges(modelEdges: EdgeInfo[], edges: Edge[]): void {
  for (const e of modelEdges) {
    edges.push({
      id: `dep:${e.from}-${e.to}`,
      source: e.from,
      target: e.to,
      animated: e.count >= 3,
      label: String(e.count),
    })
  }
}
