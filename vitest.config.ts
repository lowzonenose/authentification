import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/**/*.d.ts'],
      reporter: ['text', 'lcov'],
    },
    environmentOptions: {
      jsdom: { url: 'https://app.example.org/' },
    },
  },
})