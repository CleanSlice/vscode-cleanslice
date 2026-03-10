<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { vscode } from '../../vscode'
import logo from '@/assets/img/logo.svg'

const loading = ref(false)
const error = ref<string | null>(null)

function initProject() {
  loading.value = true
  error.value = null
  vscode.postMessage({ type: 'initProject' })
}

function onMessage(event: MessageEvent) {
  if (event.data.type === 'initResult') {
    loading.value = false
    error.value = event.data.success ? null : (event.data.error || 'Initialization failed')
  }
}

onMounted(() => window.addEventListener('message', onMessage))
onUnmounted(() => window.removeEventListener('message', onMessage))
</script>

<template>
  <div class="flex h-screen w-screen items-center justify-center">
    <Card class="max-w-sm text-center">
      <CardHeader class="items-center">
        <img :src="logo" alt="CleanSlice Studio" class="h-12 w-12" />
        <CardTitle class="text-xl">CleanSlice Studio</CardTitle>
        <CardDescription>
          No project model found. Run the sync engine to scan your codebase and generate the slice dependency graph.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button :disabled="loading" class="w-full" @click="initProject">
          <Loader2 v-if="loading" class="animate-spin" />
          {{ loading ? 'Initializing...' : 'Initialize Project' }}
        </Button>
      </CardContent>
      <CardFooter v-if="error" class="pt-0">
        <Alert variant="destructive" class="w-full">
          <AlertDescription>{{ error }}</AlertDescription>
        </Alert>
      </CardFooter>
    </Card>
  </div>
</template>
