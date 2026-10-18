import { build } from 'esbuild'
import { gzipSync } from 'node:zlib'

const budget = 15 * 1024
const result = await build({
  entryPoints: ['src/index.js'],
  bundle: true,
  minify: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  external: ['vue', 'vue-router', 'oidc-client-ts'],
  write: false,
})
const size = gzipSync(result.outputFiles[0].contents).byteLength

console.log(`Library bundle: ${(size / 1024).toFixed(2)} KiB gzip (budget: 15 KiB)`)
if (size > budget) process.exitCode = 1