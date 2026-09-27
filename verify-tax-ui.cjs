const { chromium, expect } = require('@playwright/test');
const data = require('./data/property-tax.json');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 1100 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.TEST_URL || 'http://localhost:8081', { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByText('Property tax details', { exact: true }).click();
    // All location/tax changes must work without a network after loading the app.
    await context.setOffline(true);
    const zip = page.getByRole('textbox', { name: 'ZIP code', exact: true });
    await zip.fill('07030');
    await expect(page.getByText('State fallback', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(`${data.states.NJ.toFixed(2)}%`, { exact: true })).toBeVisible();
    await expect(page.getByText(/Hoboken, NJ/).first()).toBeVisible();
    await zip.fill('06390');
    await expect(page.getByText(/Fishers Island, NY/).first()).toBeVisible();
    await zip.fill('97229-1234');
    await expect(zip).toHaveValue('97229-1234');
    await zip.blur();
    await expect.poll(() => zip.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await expect(page.getByText('ZIP-area estimate', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(`${data.areas['97229'][0].toFixed(2)}%`, { exact: true })).toBeVisible();
    await expect(page.getByText(/2020–2024/).first()).toBeVisible();
    await page.screenshot({ path: 'verification-offline-tax.png', fullPage: true });
    await page.getByText('Postal directory: GeoNames · CC BY 4.0', { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'verification-tax-sources.png', fullPage: true });
    for (const value of ['070', 'abc97229', '97229-12']) {
      await zip.fill(value);
      await expect(page.getByText('Enter a valid 5-digit ZIP or ZIP+4', { exact: true })).toBeVisible();
    }
    await zip.fill('00000');
    await expect(page.getByText(/ZIP 00000 not in offline directory/).first()).toBeVisible();
    await zip.fill('00901');
    await expect(zip).toHaveValue('00901');
    await expect(page.getByText('ZIP-area estimate', { exact: true }).first()).toBeVisible();
    await zip.fill('96799');
    await expect(page.getByText('National fallback', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/U.S. placeholder may not apply/)).toBeVisible();
    await page.getByText('Use manual tax rate', { exact: true }).click();
    await page.getByRole('textbox', { name: 'Manual annual tax rate', exact: true }).fill('0');
    await expect(page.getByText('Manual override', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('0.00%', { exact: true })).toBeVisible();
    await zip.fill('07030-1234');
    await page.waitForTimeout(500);
    await context.setOffline(false);
    await page.reload({ waitUntil: 'networkidle' });
    await expect(zip).toHaveValue('07030-1234');
    await page.getByText('Property tax details', { exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Manual annual tax rate', exact: true })).toHaveValue('0');
    await expect(page.getByText('Manual override', { exact: true }).first()).toBeVisible();
    expect(errors).toEqual([]);
    console.log('PASS: offline tax lookup, ZIP+4, errors, leading zeros, territory fallback, 0% manual override and persistence');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
