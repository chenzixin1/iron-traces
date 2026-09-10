import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  build: {
    // The dedicated Three.js runtime is ~513 kB raw, ~130 kB compressed.
    chunkSizeWarningLimit: 600,
    rollupOptions: { output: { manualChunks: { three: ["three"] } } },
  },
});
