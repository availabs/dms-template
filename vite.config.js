import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  resolve: {
    alias: {
      lodash: 'lodash-es'
    }
  },
  build: {
    rollupOptions: {
      output: {
        // You can define a manualChunks function for custom splitting
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            return 'vendor'; // This will put all node_modules into a single 'vendor.js' chunk
          }
        },
      },
    }
  },
  plugins: [
    react({
        babel: {
          // Add the compiler plugin to the Babel configuration
          plugins: [
            'babel-plugin-react-compiler',
            // Or with options: ['babel-plugin-react-compiler', ReactCompilerConfig],
          ],
        },
      }),
    tailwindcss()
  ],
})
