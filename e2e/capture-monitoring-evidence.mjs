import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const password = process.env.GRAFANA_EVIDENCE_PASSWORD;
if (!password) throw new Error('Set GRAFANA_EVIDENCE_PASSWORD for this local capture.');

const evidence = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../demo/evidence');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

  await page.goto('http://127.0.0.1:9090/targets?search=signaldesk', { waitUntil: 'domcontentloaded' });
  await page.getByText('signaldesk', { exact: false }).first().waitFor({ timeout: 20000 });
  await page.screenshot({ path: path.join(evidence, 'live-prometheus-targets.png'), fullPage: true });
  console.log('Captured Prometheus Targets UI.');

  await page.goto('http://127.0.0.1:3001/login', { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="user"]').fill('admin');
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: /log in/i }).click();
  await page.waitForURL(url => !url.pathname.endsWith('/login'), { timeout: 20000 });
  await page.goto('http://127.0.0.1:3001/d/signaldesk-incidents/signaldesk-incident-api', { waitUntil: 'domcontentloaded' });
  await page.getByText('SignalDesk incident API', { exact: false }).first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(evidence, 'live-grafana-dashboard.png'), fullPage: true });
  console.log('Captured Grafana SignalDesk dashboard UI.');
} finally {
  await browser.close();
}
