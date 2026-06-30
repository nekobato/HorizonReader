import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.test.ts']
  },
  resolve: {
    alias: {
      '@shared': new URL('./src/shared', import.meta.url).pathname
    }
  }
})
