import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  root: 'client',
  publicDir: path.resolve(import.meta.dirname, '../../public'),
  plugins: [
    react(),
    tailwindcss(),
    wasm(),
    topLevelAwait(),
  ],
  resolve: {
    alias: {
      '@dms': path.resolve(import.meta.dirname, '../../src/dms/packages/dms/src'),
      // Ensure @lexical/react's CollaborationPlugin finds yjs + y-protocols
      // from toy-sync's node_modules (not parent's, which doesn't have them)
      'yjs': path.resolve(import.meta.dirname, 'node_modules/yjs'),
      'y-protocols': path.resolve(import.meta.dirname, 'node_modules/y-protocols'),
    },
  },
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
      'Cross-Origin-Embedder-Policy': 'credentialless',
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
