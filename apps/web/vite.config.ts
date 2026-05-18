import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    sveltekit(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Hone",
        short_name: "Hone",
        description: "Self-hosted fitness PWA with AI workout generation",
        theme_color: "#1a1a2e",
        background_color: "#1a1a2e",
        display: "standalone",
        lang: "de",
        start_url: "/",
        scope: "/",
        icons: [],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        runtimeCaching: [
          {
            handler: "CacheFirst",
            options: {
              cacheName: "hone-app-shell",
              expiration: {
                maxAgeSeconds: 30 * 24 * 60 * 60,
                maxEntries: 50,
              },
            },
            urlPattern: ({ request, url }) =>
              request.mode === "navigate" || url.pathname === "/",
          },
          {
            handler: "CacheFirst",
            options: {
              cacheName: "hone-fonts",
              expiration: {
                maxAgeSeconds: 365 * 24 * 60 * 60,
                maxEntries: 10,
              },
            },
            urlPattern: ({ url }) => url.pathname.endsWith(".woff2"),
          },
          {
            handler: "CacheFirst",
            options: {
              cacheName: "hone-images",
              expiration: {
                maxAgeSeconds: 60 * 24 * 60 * 60,
                maxEntries: 200,
              },
            },
            urlPattern: ({ url }) => url.pathname.endsWith(".webp"),
          },
          {
            handler: "NetworkFirst",
            options: {
              cacheName: "hone-api",
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 100,
              },
            },
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
          },
        ],
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 250,
    target: "es2022",
  },
});
