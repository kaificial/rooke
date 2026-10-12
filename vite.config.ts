import { defineConfig } from 'vitest/config'

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 600, // the three.js chunk is ~530 kB and is expected to be large
    rollupOptions: {
      output: {
        // Three.js is the bulk of the bundle and rarely changes; its own chunk caches well.
        manualChunks: { three: ['three'] },
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
