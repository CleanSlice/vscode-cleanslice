<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import { Server, Monitor } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

defineProps<{
  data: {
    label: string
    appType: 'api' | 'frontend'
    techStack: string[]
    swaggerUrl?: string
    sliceCount: number
  }
}>()
</script>

<template>
  <Card class="w-[280px] border-primary cursor-pointer transition-colors hover:border-ring">
    <CardHeader class="p-4 pb-2">
      <div class="flex items-center gap-2">
        <Server v-if="data.appType === 'api'" class="size-5 text-primary" />
        <Monitor v-else class="size-5 text-primary" />
        <CardTitle class="text-base font-bold uppercase tracking-wide">{{ data.label }}</CardTitle>
      </div>
    </CardHeader>
    <CardContent class="px-4 pb-4 pt-1 space-y-2">
      <div class="flex flex-wrap gap-1">
        <Badge v-for="tech in data.techStack" :key="tech" variant="secondary" class="text-[10px] px-1.5 py-0">
          {{ tech }}
        </Badge>
      </div>
      <div v-if="data.swaggerUrl" class="text-xs text-muted-foreground font-mono">
        {{ data.swaggerUrl }}
      </div>
      <div class="text-xs text-muted-foreground">
        {{ data.sliceCount }} slices
      </div>
    </CardContent>
    <Handle id="top" type="source" :position="Position.Top" />
    <Handle id="right" type="source" :position="Position.Right" />
    <Handle id="bottom" type="source" :position="Position.Bottom" />
    <Handle id="left" type="source" :position="Position.Left" />
  </Card>
</template>
