// Render captured command output as a readable screenshot without changing its text.
// Usage: node e2e/render-command-evidence.mjs <input.txt> <output.png> <title>
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const [input, output, title] = process.argv.slice(2);
if (!input || !output || !title) {
  throw new Error('Pass an input text file, output PNG path, and title.');
}

const content = await readFile(input, 'utf8');
const escaped = content.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const escapedTitle = title.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #11151b; color: #e8edf4; font-family: Consolas, 'Cascadia Code', monospace; }
    header { background: #232b36; border-bottom: 1px solid #3a4759; padding: 18px 28px; font: 600 20px system-ui; }
    header span { color: #68d6bd; }
    .note { padding: 15px 28px 0; color: #9eabb9; font: 14px system-ui; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; margin: 0; padding: 22px 28px 38px;
          font: 18px/1.42 Consolas, 'Cascadia Code', monospace; tab-size: 4; }
  </style></head><body><header><span>SignalDesk evidence</span> · ${escapedTitle}</header>
    <div class="note">Actual captured command output. Selected or redacted lines are identified in the text below.</div>
    <pre>${escaped}</pre></body></html>`);
  await page.screenshot({ path: output, fullPage: true, animations: 'disabled' });
  console.log(`Captured ${output}`);
} finally {
  await browser.close();
}
