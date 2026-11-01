import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

// GitHub Pages hostet unter /<repo-name>/ – lokal und im Preview funktioniert der Pfad ebenfalls.
export default defineConfig({
  base: '/Schreibmaschine/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    chunkSizeWarningLimit: 1200,
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff,woff2,wav,png,svg,jpg}'],
        // Die 8K-Aussichten nicht alle vorab laden: gespeichert wird, was einmal angesehen wurde
        globIgnores: ['views/**', 'textures/desk_diff_4k.jpg'],
        runtimeCaching: [
          {
            urlPattern: /\/(views\/.*|textures\/desk_diff_4k)\.jpg$/,
            handler: 'CacheFirst',
            options: { cacheName: 'views', cacheableResponse: { statuses: [200] } },
          },
        ],
      },
      manifest: {
        name: 'Schreibmaschine',
        short_name: 'Schreibmaschine',
        description: '3D-Schreibmaschinen-Simulator',
        lang: 'de',
        theme_color: '#1b1714',
        background_color: '#1b1714',
        display: 'standalone',
        orientation: 'any',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
