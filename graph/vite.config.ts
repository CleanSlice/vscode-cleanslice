import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
    dedupe: ['@vueuse/core', '@vueuse/shared', 'vue'],
  },
  build: {
    outDir: '../dist/webview',
    emptyOutDir: true,
  },
  base: './',
})
