<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import { Cog, Diamond, FileText, ArrowDownToLine, ArrowUpFromLine, Layers } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

defineProps<{
  data: {
    label: string
    type: 'setup' | 'feature'
    fileCount?: number
    subsliceCount?: number
    isSubslice?: boolean
    depsIn?: number
    depsOut?: number
  }
}>()
</script>

<template>
  <Card
    class="cursor-pointer transition-colors hover:border-ring"
    :class="[
      data.isSubslice ? 'w-[160px] opacity-90' : 'w-[200px]',
      data.type === 'setup' ? 'border-chart-4' : 'border-chart-1',
    ]"
  >
    <CardHeader class="p-3 pb-1">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5">
          <Cog v-if="data.type === 'setup'" class="size-3.5 text-chart-4" />
          <Diamond v-else class="size-3.5 text-chart-1" />
          <CardTitle class="text-sm font-semibold">{{ data.label }}</CardTitle>
        </div>
        <Badge variant="secondary" class="text-[10px] px-1.5 py-0">
          {{ data.type }}
        </Badge>
      </div>
    </CardHeader>
    <CardContent class="flex items-center gap-3 px-3 pb-3 pt-1">
      <div v-if="data.fileCount" class="flex items-center gap-1 text-xs text-muted-foreground">
        <FileText class="size-3" />
        <span>{{ data.fileCount }}</span>
      </div>
      <div v-if="data.subsliceCount" class="flex items-center gap-1 text-xs text-muted-foreground">
        <Layers class="size-3" />
        <span>{{ data.subsliceCount }}</span>
      </div>
      <div v-if="data.depsIn" class="flex items-center gap-1 text-xs text-muted-foreground">
        <ArrowDownToLine class="size-3" />
        <span>{{ data.depsIn }}</span>
      </div>
      <div v-if="data.depsOut" class="flex items-center gap-1 text-xs text-muted-foreground">
        <ArrowUpFromLine class="size-3" />
        <span>{{ data.depsOut }}</span>
      </div>
    </CardContent>
    <Handle type="target" :position="Position.Left" />
    <Handle type="source" :position="Position.Right" />
  </Card>
</template>
