import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [react(), VitePWA({
    registerType: 'prompt',
    includeAssets: ['icon.svg'],
    manifest: {
      name: 'PocketLedger — Your money, your device',
      short_name: 'PocketLedger',
      description: 'A private, free, offline expense tracker.',
      theme_color: '#123b36',
      background_color: '#f5f7f4',
      display: 'standalone',
      start_url: './',
      scope: './',
      icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
    },
    workbox: { globPatterns: ['**/*.{js,css,html,svg,webmanifest}'], navigateFallback: 'index.html' },
  })],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
