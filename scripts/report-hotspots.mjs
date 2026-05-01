#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOTS = ['web', 'backend', 'scripts', '.']
const SOURCE_EXTENSIONS = new Set([
  '.css',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.py',
  '.ts',
  '.tsx',
  '.vue',
])
const DEFAULT_IGNORES = [
  '.git',
  '.hermes',
  '.runtime',
  '.nuxt',
  '.output',
  'dist',
  'build',
  'coverage',
  'node_modules',
  '.venv',
  '__pycache__',
]

function readIgnoreEntries() {
  try {
    return readFileSync('.ignore', 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => line.replace(/\/$/, ''))
  } catch {
    return []
  }
}

const ignoredNames = new Set([...DEFAULT_IGNORES, ...readIgnoreEntries()])
const seenFiles = new Set()
const files = []
const directoryTotals = new Map()

function extensionOf(path) {
  const match = path.match(/\.[^.]+$/)
  return match?.[0] ?? ''
}

function isIgnored(path) {
  const parts = path.split('/').filter(Boolean)
  return parts.some((part) => ignoredNames.has(part))
}

function addDirectoryTotal(filePath, lineCount) {
  const parts = filePath.split('/')
  const directory = parts.length > 2 ? parts.slice(0, 3).join('/') : parts.slice(0, -1).join('/') || '.'
  directoryTotals.set(directory, (directoryTotals.get(directory) ?? 0) + lineCount)
}

function walk(path) {
  if (isIgnored(path)) return

  const stat = statSync(path)
  if (stat.isDirectory()) {
    for (const entry of readdirSync(path)) {
      walk(join(path, entry))
    }
    return
  }

  if (!stat.isFile()) return
  if (!SOURCE_EXTENSIONS.has(extensionOf(path))) return

  const normalized = relative('.', path) || path
  if (seenFiles.has(normalized)) return
  seenFiles.add(normalized)

  const content = readFileSync(path, 'utf8')
  const lineCount = content.length ? content.split('\n').length : 0
  files.push({ path: normalized, lines: lineCount })
  addDirectoryTotal(normalized, lineCount)
}

for (const root of ROOTS) {
  try {
    walk(root)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

files.sort((a, b) => b.lines - a.lines || a.path.localeCompare(b.path))

console.log('Top source hotspots')
for (const file of files.slice(0, 30)) {
  console.log(`${String(file.lines).padStart(5)} ${file.path}`)
}

console.log('\nDirectory totals')
const totals = [...directoryTotals.entries()]
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  .slice(0, 30)

for (const [directory, lines] of totals) {
  console.log(`${String(lines).padStart(5)} ${directory}`)
}
