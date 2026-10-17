import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const password = process.env.ARGOCD_EVIDENCE_PASSWORD;
if (!password) throw new Error('Set ARGOCD_EVIDENCE_PASSWORD for this local capture.');

const evidence = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../demo/evidence');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true,
  });
  await page.goto('https://127.0.0.1:8081/login', { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="username"]').fill('admin');
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(url => !url.pathname.endsWith('/login'), { timeout: 20000 });
  await page.goto('https://127.0.0.1:8081/applications/argocd/signaldesk', { waitUntil: 'domcontentloaded' });
  await page.getByText('Healthy', { exact: true }).first().waitFor({ timeout: 20000 });
  await page.getByText('Synced', { exact: true }).first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(evidence, 'live-argocd-signaldesk.png'), fullPage: true });
  console.log('Captured ArgoCD SignalDesk application UI.');
} finally {
  await browser.close();
}
