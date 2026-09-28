const { chromium, expect } = require('@playwright/test');
(async () => {
 const browser = await chromium.launch();
 try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 1400 } });
  await page.goto(process.env.TEST_URL || 'http://localhost:8081', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.setItem('loanglow:last-inputs:v1', JSON.stringify({ termYears: 25, loanType: 'arm', armPeriod: 7, scenarioRate: '8.5', interestRate: '6.25' })));
  await page.reload({ waitUntil: 'networkidle' });
  const basic = page.getByTestId('basic-inputs');
  const rate = page.getByRole('textbox', { name: 'Interest rate', exact: true });
  await expect(basic.getByRole('textbox', { name: 'Interest rate', exact: true })).toHaveValue('6.25');
  await expect(page.getByTestId('scenario-total')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Custom term', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Advanced loan options', exact: true }).click();
  await expect(basic.getByRole('textbox', { name: 'Interest rate', exact: true })).toHaveCount(0);
  await expect(rate).toHaveCount(1);
  await expect(page.getByTestId('advanced-inputs').getByRole('textbox', { name: 'Interest rate', exact: true })).toHaveValue('6.25');
  await expect(page.getByText('7/1 ARM · 25-year term', { exact: true })).toBeVisible();
  await expect(page.getByTestId('scenario-total')).toBeVisible();
  await rate.fill('6.75');
  await page.getByRole('button', { name: 'Back to basic', exact: true }).click();
  await expect(basic.getByRole('textbox', { name: 'Interest rate', exact: true })).toHaveValue('6.75');
  await expect(page.getByTestId('scenario-total')).toHaveCount(0);
  await expect(page.getByText('30 years', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'verification-basic-mode.png', fullPage: true });
  await page.getByRole('button', { name: '15 yr', exact: true }).click();
  await page.getByRole('button', { name: 'Advanced loan options', exact: true }).click();
  await expect(page.getByText('7/1 ARM · 25-year term', { exact: true })).toBeVisible();
  await expect(rate).toHaveValue('6.75');
  await expect(page.getByTestId('advanced-inputs')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: 'verification-advanced-mode.png', fullPage: true });
  await page.waitForTimeout(400);
  await page.reload({ waitUntil: 'networkidle' });
  await expect(basic.getByRole('textbox', { name: 'Interest rate', exact: true })).toHaveValue('6.75');
  await expect(page.getByTestId('scenario-total')).toHaveCount(0);
  console.log('PASS: basic-first launch, explicit Advanced takeover, return to basic, saved advanced settings retained');
 } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
