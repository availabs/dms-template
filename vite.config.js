import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  resolve: {
    alias: [
      { find: '~', replacement: path.resolve(__dirname, 'src') },
      { find: "lodash", replacement: 'lodash-es' }
    ]
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        // You can define a manualChunks function for custom splitting
        manualChunks: (id) => {
          if (id.includes('maplibre-gl')) {
            return 'maplibre';
          } else if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    }
  },
  plugins: [
    react({
        babel: {
          plugins: [
            'babel-plugin-react-compiler',
            // Or with options: ['babel-plugin-react-compiler', ReactCompilerConfig],
          ],
        },
      }),
    tailwindcss()
  ],
})