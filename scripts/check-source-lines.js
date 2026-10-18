import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('../src/', import.meta.url)
const maximumLines = 650

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return entry.isFile() && path.endsWith('.js') ? [path] : []
  })
}

const files = sourceFiles(root.pathname)
const lineCount = files.reduce((total, file) =>
  total + readFileSync(file, 'utf8').split(/\r?\n/).filter((line) => line.trim()).length, 0)

console.log(`Runtime source: ${lineCount} non-empty lines (limit: < ${maximumLines})`)
if (lineCount >= maximumLines) process.exitCode = 1