import { defineConfig, splitVendorChunkPlugin } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      lodash: 'lodash-es'
    }
  },
  plugins: [react(),splitVendorChunkPlugin()],
})
