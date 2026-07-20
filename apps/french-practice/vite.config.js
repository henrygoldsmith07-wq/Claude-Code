import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        // React in its own long-cacheable chunk → smaller app chunk, faster
        // repeat loads, parallel first download.
        manualChunks: { vendor: ['react', 'react-dom'] },
      },
    },
  },
});
