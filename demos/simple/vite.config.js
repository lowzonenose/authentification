import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ command }) => ({
  base: process.env.BASE_URL || '/demo/',
  envDir: '.',
  envPrefix: ["VITE_", "IAM_"],
  plugins: [
    vue(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // En dev, la librairie est servie depuis src/ pour éviter un dist/ périmé.
      ...(command === 'serve'
        ? { 'authentification-vue-oidc': fileURLToPath(new URL('../../src/index.js', import.meta.url)) }
        : {}),
    }
  }
}))
