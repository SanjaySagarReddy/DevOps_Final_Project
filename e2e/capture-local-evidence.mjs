// Capture the real Compose-served incident workflow for local grading evidence.
// Run from e2e/: node capture-local-evidence.mjs
import { chromium, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const baseURL = process.env.EVIDENCE_BASE_URL || 'http://127.0.0.1:3000'
const evidencePrefix = process.env.EVIDENCE_PREFIX || 'local'
if (!/^[a-z0-9-]+$/.test(evidencePrefix)) throw new Error('Invalid evidence prefix')
const evidenceDir = fileURLToPath(new URL('../demo/evidence/', import.meta.url))
await mkdir(evidenceDir, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  for (const device of [
    { name: 'desktop', viewport: { width: 1440, height: 900 } },
    { name: 'mobile', viewport: { width: 390, height: 844 } },
  ]) {
    const context = await browser.newContext({ viewport: device.viewport, deviceScaleFactor: 1 })
    const page = await context.newPage()
    const title = `Evidence ${device.name} checkout outage`
    const editedTitle = `Evidence ${device.name} checkout recovery`
    let incidentId
    const capture = async (stage) => {
      const path = `${evidenceDir}${evidencePrefix}-${device.name}-${stage}.png`
      await page.screenshot({ path, fullPage: true, animations: 'disabled' })
      console.log(`${page.url()} -> ${path}`)
    }

    try {
      await page.goto(baseURL, { waitUntil: 'networkidle' })
      await expect(page.getByRole('heading', { name: 'Incident overview' })).toBeVisible()
      await expect(page.locator('.incident-panel')).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(device.viewport.width)
      await capture('dashboard')

      await page.getByRole('button', { name: 'Declare incident' }).click()
      await page.getByLabel('Incident title').fill(title)
      await page.getByLabel('Affected service').fill('Checkout API')
      await page.getByRole('dialog').getByLabel('Severity').selectOption('high')
      await page.getByLabel('Response owner').fill('Primary on-call')
      await page.getByLabel('Description and impact').fill('Customers cannot complete checkout requests.')
      await page.getByRole('button', { name: 'Create incident' }).click()
      const drawer = page.locator('.detail-drawer')
      await expect(drawer.getByRole('heading', { name: title })).toBeVisible()
      await expect(drawer.locator('.status-open')).toBeVisible()
      incidentId = Number((await drawer.getAttribute('aria-label')).match(/Incident (\d+) details/)[1])
      await capture('created')

      await drawer.getByRole('button', { name: 'Edit details' }).click()
      await page.getByLabel('Incident title').fill(editedTitle)
      await page.getByLabel('Response owner').fill('Secondary on-call')
      await page.getByRole('button', { name: 'Save changes' }).click()
      await expect(drawer.getByRole('heading', { name: editedTitle })).toBeVisible()
      await expect(drawer).toContainText('Secondary on-call')
      await capture('edited')

      for (const status of ['investigating', 'mitigated', 'resolved']) {
        await drawer.getByRole('button', { name: `Mark ${status}` }).click()
        await expect(drawer.locator(`.status-${status}`)).toBeVisible()
        await capture(status)
      }

      page.once('dialog', (dialog) => dialog.accept())
      await drawer.getByRole('button', { name: 'Delete incident' }).click()
      await expect(drawer).toHaveCount(0)
      await expect(page.getByText(editedTitle, { exact: true })).toHaveCount(0)
      incidentId = undefined
      await capture('deleted')
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(device.viewport.width)
      console.log(`${device.name}: create, edit, investigate, mitigate, resolve, delete verified`)
    } finally {
      if (incidentId !== undefined) {
        await context.request.delete(`${baseURL}/api/incidents/${incidentId}`)
      }
      await context.close()
    }
  }
} finally {
  await browser.close()
}
