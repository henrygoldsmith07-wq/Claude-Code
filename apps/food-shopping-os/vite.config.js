import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Forq — Food Shopping OS',
        short_name: 'Forq',
        description: 'Plan meals, shop smarter, cook better — spend less and waste less.',
        theme_color: '#111111',
        background_color: '#fafafa',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) return 'vendor';
          if (id.includes('/src/data/') || id.includes('\\src\\data\\')) return 'reference';
          if (id.includes('/src/lib/') || id.includes('\\src\\lib\\')) {
            const file = id.split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
            if (/^(advice|ai-assistant|analytics|cgm|coach|exercise|fasting|footprint|foodlog|goals|health|household|kitchen|label|mealplan|micro-optimise|nutrition|notify|photos|planner|progress|receipt|recipe-ai|recipe-tools|reminders|reports|report-export|shopping|smart|smart-capture|units)$/.test(file)) return 'domain';
          }
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/setup.js'],
    include: ['tests/**/*.test.{js,jsx}'],
  },
});
