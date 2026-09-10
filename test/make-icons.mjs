/**
 * Rendert das App-Symbol für den Startbildschirm in echtem Chromium.
 *
 * Kein Grafikprogramm nötig: Die Vorlage ist HTML, der Browser macht das
 * Bild. Änderungen am Symbol sind damit eine CSS-Änderung, kein neuer
 * Dateiaustausch.
 */
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';

const TEMPLATE = process.argv[2] ?? 'test/icon.html';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const browser = await chromium.launch({ executablePath: CHROME });
for (const size of [192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(readFileSync(TEMPLATE, 'utf8'));
  const scale = size / 512;
  await page.addStyleTag({
    content: `html,body{width:${size}px;height:${size}px}
      .moon{width:${Math.round(size * 0.49)}px;height:${Math.round(size * 0.49)}px;
            box-shadow:0 0 ${Math.round(90 * scale)}px rgba(242,201,111,.45)}
      .s{transform:scale(${scale});transform-origin:top left}`,
  });
  await page.screenshot({ path: `public/icon-${size}.png` });
  await page.close();
  console.log(`public/icon-${size}.png`);
}
await browser.close();
