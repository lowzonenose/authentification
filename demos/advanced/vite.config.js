import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ command }) => ({
  envDir: '.',
  envPrefix: ["VITE_", "IAM_"],
  plugins: [vue()],
  // En dev, la librairie est servie depuis src/ pour éviter un dist/ périmé.
  ...(command === 'serve'
    ? { resolve: { alias: { 'authentification-vue-oidc': fileURLToPath(new URL('../../src/index.js', import.meta.url)) } } }
    : {}),
}))