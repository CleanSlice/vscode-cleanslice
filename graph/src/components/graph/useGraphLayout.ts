import { MarkerType } from '@vue-flow/core'
import type { Node, Edge } from '@vue-flow/core'
import type { AppInfo, SliceInfo, EdgeInfo } from './types'

// ---------------------------------------------------------------------------
//  Constants
// ---------------------------------------------------------------------------

const SLICE_WIDTH = 200
const SLICE_HEIGHT = 110
const SUB_SLICE_WIDTH = 160
const SUB_ROW_GAP = 10
const HUB_WIDTH = 280
const HUB_HEIGHT = 120

const COL_GAP = 40
const ROW_GAP = 30
const HUB_SIDE_GAP = 80
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

    let clusterX = 0

    for (const appName of [...appGroups.keys()].sort()) {
      const group = appGroups.get(appName)!
      const app = appMeta.get(appName)

      // Lay out setup grid to the left, feature grid to the right
      const setupGrid = computeGrid(group.setup, subsByParent)
      const featureGrid = computeGrid(group.feature, subsByParent)

      // Hub center X: leave room for the setup grid on the left
      const setupGridWidth = setupGrid.totalWidth
      const featureGridWidth = featureGrid.totalWidth

      const hubCx = clusterX + setupGridWidth + (setupGridWidth > 0 ? HUB_SIDE_GAP : 0) + HUB_WIDTH / 2
      const hubCy = 0

      // Hub node
      nodes.push(buildHubNode(appName, hubCx, hubCy, app))

      // Place setup slices to the left of the hub
      if (group.setup.length > 0) {
        const gridRight = hubCx - HUB_WIDTH / 2 - HUB_SIDE_GAP
        const gridStartX = gridRight - setupGridWidth
        const gridStartY = hubCy - HUB_HEIGHT / 2
        placeGrid(group.setup, setupGrid, gridStartX, gridStartY, subsByParent, depsIn, depsOut, nodes, edges)
      }

      // Place feature slices to the right of the hub
      if (group.feature.length > 0) {
        const gridStartX = hubCx + HUB_WIDTH / 2 + HUB_SIDE_GAP
        const gridStartY = hubCy - HUB_HEIGHT / 2
        placeGrid(group.feature, featureGrid, gridStartX, gridStartY, subsByParent, depsIn, depsOut, nodes, edges)
      }

      // Spoke edges (hub → slices with deps)
      const topLevel = [...group.setup, ...group.feature]
      for (const s of topLevel) {
        const hasDeps = hasAnyDeps(s, subsByParent, depsIn, depsOut)
        if (!hasDeps) continue
        edges.push({
          id: `spoke:${appName}-${s.name}`,
          source: `hub:${appName}`,
          target: s.name,
          type: 'smoothstep',
          animated: false,
          style: { stroke: 'var(--color-border)', strokeWidth: 1, opacity: 0.25 },
        })
      }

      const totalWidth = setupGridWidth
        + (setupGridWidth > 0 ? HUB_SIDE_GAP : 0)
        + HUB_WIDTH
        + (featureGridWidth > 0 ? HUB_SIDE_GAP : 0)
        + featureGridWidth

      clusterX += totalWidth + CLUSTER_GAP
    }

    layoutDependencyEdges(modelEdges, nodes, edges)
    return { nodes, edges }
  }

  return { layout }
}

// ---------------------------------------------------------------------------
//  Grid computation
// ---------------------------------------------------------------------------

interface GridInfo {
  cols: number
  rows: number
  rowHeights: number[]
  totalWidth: number
  totalHeight: number
}

function columnHeight(subCount: number): number {
  return SLICE_HEIGHT + subCount * (SLICE_HEIGHT + SUB_ROW_GAP)
}

function optimalCols(count: number): number {
  if (count <= 2) return count
  if (count <= 6) return 2
  if (count <= 12) return 3
  return 4
}

function computeGrid(slices: SliceInfo[], subsByParent: Map<string, SliceInfo[]>): GridInfo {
  if (slices.length === 0) return { cols: 0, rows: 0, rowHeights: [], totalWidth: 0, totalHeight: 0 }

  const cols = optimalCols(slices.length)
  const rows = Math.ceil(slices.length / cols)
  const rowHeights: number[] = []

  for (let row = 0; row < rows; row++) {
    let maxH = SLICE_HEIGHT
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col
      if (idx >= slices.length) break
      const subCount = subsByParent.get(slices[idx].name)?.length ?? 0
      maxH = Math.max(maxH, columnHeight(subCount))
    }
    rowHeights.push(maxH)
  }

  const totalWidth = cols * SLICE_WIDTH + (cols - 1) * COL_GAP
  const totalHeight = rowHeights.reduce((sum, h) => sum + h, 0) + (rows - 1) * ROW_GAP

  return { cols, rows, rowHeights, totalWidth, totalHeight }
}

function placeGrid(
  slices: SliceInfo[],
  grid: GridInfo,
  startX: number,
  startY: number,
  subsByParent: Map<string, SliceInfo[]>,
  depsIn: Map<string, number>,
  depsOut: Map<string, number>,
  nodes: Node[],
  edges: Edge[],
): void {
  let y = startY
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const idx = row * grid.cols + col
      if (idx >= slices.length) break
      const s = slices[idx]
      const x = startX + col * (SLICE_WIDTH + COL_GAP) + SLICE_WIDTH / 2
      const sliceY = y + SLICE_HEIGHT / 2

      nodes.push(buildSliceNode(s, x, sliceY, depsIn, depsOut))

      // Subslices — stacked below parent
      const subs = subsByParent.get(s.name) ?? []
      for (let i = 0; i < subs.length; i++) {
        const sy = sliceY + (i + 1) * (SLICE_HEIGHT + SUB_ROW_GAP)
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
    y += grid.rowHeights[row] + ROW_GAP
  }
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

/** Check if a slice or any of its subslices has dependency edges. */
function hasAnyDeps(
  s: SliceInfo,
  subsByParent: Map<string, SliceInfo[]>,
  depsIn: Map<string, number>,
  depsOut: Map<string, number>,
): boolean {
  if ((depsIn.get(s.name) ?? 0) > 0 || (depsOut.get(s.name) ?? 0) > 0) return true
  const subs = subsByParent.get(s.name) ?? []
  return subs.some(sub => (depsIn.get(sub.name) ?? 0) > 0 || (depsOut.get(sub.name) ?? 0) > 0)
}

// ---------------------------------------------------------------------------
//  Slice type inference
// ---------------------------------------------------------------------------

function inferDisplayType(s: SliceInfo): 'setup' | 'feature' | 'repository' {
  if (s.type === 'setup') return 'setup'
  // Repository: has data layer, no domain, and at most 2 view files
  if (s.dataCount > 0 && s.domainCount === 0 && s.viewCount <= 2) return 'repository'
  // Flat repository: no data/domain layers but contains a repository file
  if (s.hasRepositoryFile && s.domainCount === 0 && s.dataCount === 0) return 'repository'
  return 'feature'
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
      label: s.name.split(/[:/]/).pop() ?? s.name,
      path: s.name,
      type: inferDisplayType(s),
      fileCount: s.fileCount,
      subsliceCount: s.subsliceCount,
      isSubslice,
      depsIn: depsIn.get(s.name) ?? 0,
      depsOut: depsOut.get(s.name) ?? 0,
      domainCount: s.domainCount,
      dataCount: s.dataCount,
      viewCount: s.viewCount,
      hasReadme: s.hasReadme,
    },
  }
}

// ---------------------------------------------------------------------------
//  Dependency edges
// ---------------------------------------------------------------------------

function layoutDependencyEdges(modelEdges: EdgeInfo[], nodes: Node[], edges: Edge[]): void {
  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  for (const e of modelEdges) {
    const sourceNode = nodeMap.get(e.from)
    const targetNode = nodeMap.get(e.to)

    const handles = pickHandles(sourceNode, targetNode)
    const strokeWidth = e.count >= 5 ? 2 : e.count >= 2 ? 1.5 : 1

    edges.push({
      id: `dep:${e.from}-${e.to}`,
      source: e.from,
      target: e.to,
      sourceHandle: handles.source,
      targetHandle: handles.target,
      type: 'smoothstep',
      animated: e.count >= 3,
      label: String(e.count),
      labelStyle: { fill: 'var(--vscode-foreground, #cdd6f4)', fontSize: 10 },
      labelBgStyle: { fill: 'var(--vscode-editor-background, #1e1e2e)', fillOpacity: 0.9 },
      labelBgPadding: [4, 6] as [number, number],
      markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--color-chart-2)' },
      style: { stroke: 'var(--color-chart-2)', strokeWidth },
    })
  }
}

/** Pick source/target handles based on relative node positions. */
function pickHandles(
  source: Node | undefined,
  target: Node | undefined,
): { source: string; target: string } {
  if (!source || !target) return { source: 'source-right', target: 'target-left' }

  const sx = source.position.x + SLICE_WIDTH / 2
  const sy = source.position.y + SLICE_HEIGHT / 2
  const tx = target.position.x + SLICE_WIDTH / 2
  const ty = target.position.y + SLICE_HEIGHT / 2

  const dx = tx - sx
  const dy = ty - sy

  if (Math.abs(dx) > Math.abs(dy)) {
    // Horizontal dominant
    return dx > 0
      ? { source: 'source-right', target: 'target-left' }
      : { source: 'source-left', target: 'target-right' }
  } else {
    // Vertical dominant
    return dy > 0
      ? { source: 'source-bottom', target: 'target-top' }
      : { source: 'source-top', target: 'target-bottom' }
  }
}
