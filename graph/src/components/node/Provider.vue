<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import { Cog, Diamond, Database, Layers, Circle, CircleDashed, Square, SquareDashed, Triangle, TriangleDashed, BookOpen } from 'lucide-vue-next'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import ClaudeIcon from './ClaudeIcon.vue'
import { vscode } from '../../vscode'

function handleClaudeClick(event: MouseEvent, path: string) {
  if (event.shiftKey) {
    vscode.postMessage({ type: 'toggleTeamSlice', slice: path })
  } else {
    vscode.postMessage({ type: 'openClaude', slice: path })
  }
}

defineProps<{
  data: {
    label: string
    path: string
    type: 'setup' | 'feature' | 'repository'
    fileCount?: number
    subsliceCount?: number
    isSubslice?: boolean
    depsIn?: number
    depsOut?: number
    domainCount?: number
    dataCount?: number
    viewCount?: number
    hasReadme?: boolean
    claudeActive?: boolean
    teamSelected?: boolean
    glow?: boolean
  }
}>()
</script>

<template>
  <Card
    class="cursor-pointer transition-all hover:border-ring"
    :class="[
      data.isSubslice ? 'w-[160px] opacity-90' : 'w-[200px]',
      data.type === 'setup' ? 'border-chart-4'
        : data.type === 'repository' ? 'border-chart-6'
        : (!data.isSubslice && data.depsIn === 0) ? 'border-chart-7'
        : 'border-chart-1',
      data.glow ? 'node-glow' : '',
    ]"
  >
    <button
      :class="[
        'claude-btn',
        data.claudeActive ? 'claude-active' : '',
        data.teamSelected ? 'claude-team' : '',
      ]"
      :title="data.claudeActive ? 'Close Claude Code' : 'Click: Claude Code · Shift+Click: Add to team'"
      @click.stop="handleClaudeClick($event, data.path)"
    >
      <ClaudeIcon class="size-3.5" />
    </button>
    <CardHeader class="p-3 pb-1">
      <div class="flex items-center gap-1.5">
        <Cog v-if="data.type === 'setup'" class="size-3.5 shrink-0 text-chart-4" />
        <Database v-else-if="data.type === 'repository'" class="size-3.5 shrink-0 text-chart-6" />
        <Diamond v-else class="size-3.5 shrink-0" :class="!data.isSubslice && data.depsIn === 0 ? 'text-chart-7' : 'text-chart-1'" />
        <CardTitle class="text-base font-bold leading-tight truncate">{{ data.label }}</CardTitle>
      </div>
      <p class="text-[10px] text-muted-foreground truncate mt-0.5">{{ data.path }}</p>
    </CardHeader>
    <CardContent class="flex items-center gap-2 px-3 pb-3 pt-1">
      <div class="flex items-center gap-0.5 text-xs text-muted-foreground" title="Presentation">
        <Triangle v-if="data.viewCount" class="size-3" />
        <TriangleDashed v-else class="size-3 opacity-30" />
        <span v-if="data.viewCount">{{ data.viewCount }}</span>
      </div>
      <div class="flex items-center gap-0.5 text-xs text-muted-foreground" title="Domain">
        <Circle v-if="data.domainCount" class="size-3" />
        <CircleDashed v-else class="size-3 opacity-30" />
        <span v-if="data.domainCount">{{ data.domainCount }}</span>
      </div>
      <div class="flex items-center gap-0.5 text-xs text-muted-foreground" title="Data">
        <Square v-if="data.dataCount" class="size-3" />
        <SquareDashed v-else class="size-3 opacity-30" />
        <span v-if="data.dataCount">{{ data.dataCount }}</span>
      </div>
      <div v-if="data.subsliceCount" class="flex items-center gap-0.5 text-xs text-muted-foreground">
        <Layers class="size-3" />
        <span>{{ data.subsliceCount }}</span>
      </div>
      <BookOpen v-if="data.hasReadme" class="size-3 text-chart-3 ml-auto" title="Has README" />
    </CardContent>
    <Handle id="target-top" type="target" :position="Position.Top" />
    <Handle id="target-right" type="target" :position="Position.Right" />
    <Handle id="target-bottom" type="target" :position="Position.Bottom" />
    <Handle id="target-left" type="target" :position="Position.Left" />
    <Handle id="source-top" type="source" :position="Position.Top" />
    <Handle id="source-right" type="source" :position="Position.Right" />
    <Handle id="source-bottom" type="source" :position="Position.Bottom" />
    <Handle id="source-left" type="source" :position="Position.Left" />
  </Card>
</template>

<style scoped>
.node-glow {
  box-shadow: var(--glow-box);
}

.claude-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--muted-foreground);
  opacity: 0.35;
  cursor: pointer;
}

.claude-btn:hover {
  opacity: 1;
  color: var(--primary);
  background: var(--secondary);
}

.claude-active {
  opacity: 1;
  color: #CC7C5E;
}

.claude-active:hover {
  color: #CC7C5E;
}

.claude-team {
  opacity: 1;
  color: #CC7C5E;
  background: rgba(204, 124, 94, 0.15);
  border: 1px solid rgba(204, 124, 94, 0.4);
}
</style>
