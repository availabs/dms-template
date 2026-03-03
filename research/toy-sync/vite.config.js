import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  root: 'client',
  plugins: [
    react(),
    tailwindcss(),
    wasm(),
    topLevelAwait(),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:3456',
      '/sync/': {
        target: 'http://localhost:3456',
        ws: true,
      },
    },
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  worker: {
    format: 'es',
    plugins: () => [
      wasm(),
      topLevelAwait(),
    ],
  },
  optimizeDeps: {
    exclude: ['@journeyapps/wa-sqlite'],
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
