import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: {
      '@xmcl/bytebuffer': resolve(__dirname, 'node_modules/@xmcl/bytebuffer/dist/index.mjs')
    },
    exportsFields: []
  }
})
