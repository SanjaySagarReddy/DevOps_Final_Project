import { expect, test } from '@playwright/test'

test('create, edit, resolve, and delete incident', async ({ page }) => {
  const title = `Checkout outage ${Date.now()}`
  const editedTitle = `Checkout recovery ${Date.now()}`

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Incident overview' })).toBeVisible()

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

      await drawer.getByRole('button', { name: 'Edit details' }).click()
      await page.getByLabel('Incident title').fill(editedTitle)
      await page.getByLabel('Response owner').fill('Secondary on-call')
      await page.getByRole('button', { name: 'Save changes' }).click()
      await expect(drawer.getByRole('heading', { name: editedTitle })).toBeVisible()
      await expect(drawer).toContainText('Secondary on-call')

      await drawer.getByRole('button', { name: 'Mark investigating' }).click()
      await expect(drawer.locator('.status-investigating')).toBeVisible()
      await drawer.getByRole('button', { name: 'Mark resolved' }).click()
      await expect(drawer.locator('.status-resolved')).toBeVisible()
      await expect(drawer).toContainText('Resolved')

      page.once('dialog', (dialog) => dialog.accept())
      await drawer.getByRole('button', { name: 'Delete incident' }).click()
      await expect(drawer).toHaveCount(0)
      await expect(page.getByText(editedTitle, { exact: true })).toHaveCount(0)
})

test('initial API failure does not claim the queue is clear', async ({ page }) => {
  await page.route('**/api/incidents**', (route) => route.abort())
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('Data unavailable')
  await expect(page.getByText('Your response queue is clear')).toHaveCount(0)
  await expect(page.locator('.incident-panel')).toHaveCount(0)
})

test('failed refresh labels previously loaded data as stale', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.incident-panel')).toBeVisible()
  await page.route('**/api/incidents**', (route) => route.abort())
  await page.getByRole('button', { name: 'Refresh incidents' }).click()
  await expect(page.getByRole('alert')).toContainText('Stale incident data')
  await expect(page.getByRole('alert')).toContainText('Last loaded')
  await expect(page.locator('.stale-pill')).toHaveText('STALE SNAPSHOT')
})
