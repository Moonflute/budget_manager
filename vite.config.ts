import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/budget_manager/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'icons/*.png'],
      manifest: {
        id: '/budget_manager/',
        name: 'Budget Manager',
        short_name: 'Budget Manager',
        description: '기기에 저장하는 개인 예산 관리 앱.',
        lang: 'ko',
        theme_color: '#2257a5',
        background_color: '#f4f7fc',
        display: 'standalone',
        start_url: '/budget_manager/',
        scope: '/budget_manager/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        navigateFallback: '/budget_manager/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
