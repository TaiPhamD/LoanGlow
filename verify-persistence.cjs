const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 1100 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto('http://localhost:8081', { waitUntil: 'networkidle', timeout: 60000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  const inputs = page.locator('input');
  await inputs.nth(0).fill('725000');
  await inputs.nth(1).fill('145000');
  await inputs.nth(2).fill('6.125');
  await inputs.nth(3).fill('97229');
  await inputs.nth(4).fill('225');
  await inputs.nth(5).fill('75');
  await page.getByText('15 yr').click();
  await page.waitForTimeout(500);

  await page.reload({ waitUntil: 'networkidle' });
  const values = [];
  for (let i = 0; i < 6; i += 1) {
    values.push(await inputs.nth(i).inputValue());
  }
  const body = await page.locator('body').innerText();
  const ok =
    values[0] === '725000' &&
    values[1] === '145000' &&
    values[2] === '6.125' &&
    values[3] === '97229' &&
    values[4] === '225' &&
    values[5] === '75' &&
    body.includes('15 years') &&
    body.includes('Portland, OR') &&
    errors.length === 0;

  console.log(JSON.stringify({ ok, values, has15Years: body.includes('15 years'), hasPortlandZip: body.includes('Portland, OR'), errors }, null, 2));
  if (!ok) process.exit(1);
  await browser.close();
})();
