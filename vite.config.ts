import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig(({ command, mode }) => {
  if (command === "build") {
    const env = { ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env };
    const names = [
      "VITE_FIREBASE_API_KEY",
      "VITE_FIREBASE_AUTH_DOMAIN",
      "VITE_FIREBASE_PROJECT_ID",
      "VITE_FIREBASE_STORAGE_BUCKET",
      "VITE_FIREBASE_MESSAGING_SENDER_ID",
      "VITE_FIREBASE_APP_ID",
    ];
    const missing = names.filter((name) => !env[name]?.trim());
    if (missing.length)
      throw new Error(
        "Missing deployment environment variables: " +
          missing.join(", ") +
          ". Set them in Vercel Project Settings → Environment Variables and redeploy.",
      );
  }
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "prompt",
        includeAssets: ["icon.svg", "icon-192.png", "icon-512.png"],
        manifest: {
          name: "AinSathi — আইনসাথী",
          short_name: "AinSathi",
          description: "আপনার মামলা, আপনার নিয়ন্ত্রণ",
          lang: "bn",
          id: "/",
          scope: "/",
          start_url: "/dashboard",
          display: "standalone",
          background_color: "#f4f7fa",
          theme_color: "#082940",
          icons: [
            { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,woff2,png,svg}"],
          navigateFallback: null,
          runtimeCaching: [],
          cleanupOutdatedCaches: true,
        },
      }),
    ],
    test: {
      environment: "node",
      include: ["src/**/*.test.ts", "supabase/tests/**/*.test.ts"],
    },
  };
});
