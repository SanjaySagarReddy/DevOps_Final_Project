// Capture public GitHub pages for a completed run and its two matching GHCR packages.
// Usage from e2e/: node capture-github-evidence.mjs <full commit SHA> <run ID>
import { chromium, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const [sha, runId] = process.argv.slice(2)
if (!/^[a-f0-9]{40}$/.test(sha ?? '') || !/^\d+$/.test(runId ?? '')) {
  throw new Error('Pass a full 40-character commit SHA and numeric GitHub Actions run ID')
}

const repo = 'https://github.com/SanjaySagarReddy/DevOps_Final_Project'
const evidenceDir = fileURLToPath(new URL('../demo/evidence/', import.meta.url))
await mkdir(evidenceDir, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
try {
  const page = await context.newPage()
  const capture = async (url, name, requiredText) => {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('body')).toContainText(requiredText, { timeout: 30_000 })
    await page.screenshot({ path: `${evidenceDir}github-${name}-${sha.slice(0, 7)}.png`, fullPage: true, animations: 'disabled' })
    console.log(`${page.url()} -> github-${name}-${sha.slice(0, 7)}.png`)
  }

  await capture(`${repo}/commits/main/`, 'commits', sha.slice(0, 7))
  await capture(`${repo}/actions/runs/${runId}`, 'actions-success', 'Status Success')
  await capture(`${repo}/pkgs/container/devops_final_project-backend`, 'ghcr-backend', sha)
  await capture(`${repo}/pkgs/container/devops_final_project-frontend`, 'ghcr-frontend', sha)
} finally {
  await context.close()
  await browser.close()
}
