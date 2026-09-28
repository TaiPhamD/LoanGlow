const { chromium, expect } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 1100 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(process.env.TEST_URL || 'http://localhost:8081', { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    const advanced = page.getByTestId('loan-mode-switch');
    await expect(advanced).toHaveAttribute('aria-expanded', 'false');
    await advanced.click();
    await page.getByRole('button', { name: 'Custom term', exact: true }).click();
    const years = page.getByRole('textbox', { name: 'Custom loan years', exact: true });
    await years.fill('25');
    await page.getByRole('button', { name: 'Apply term', exact: true }).click();
    await expect(page.getByText('25 years', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Adjustable rate', exact: true }).click();
    await page.getByRole('button', { name: '7/1 ARM', exact: true }).click();
    await expect(page.getByRole('button', { name: '7/1 ARM', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Estimated monthly payment', { exact: true })).toBeVisible();
    await expect(page.getByText('7/1 ARM · 25-year term', { exact: true })).toBeVisible();
    await years.fill('7');
    await page.getByRole('button', { name: 'Apply term', exact: true }).click();
    await expect(page.getByText(/Choose a term longer than 7 years/)).toBeVisible();
    await expect(page.getByText('25 years', { exact: true })).toBeVisible();
    await years.fill('25');
    await page.getByRole('button', { name: 'Apply term', exact: true }).click();
    await page.getByRole('button', { name: 'After-adjustment scenario', exact: true }).click();
    const scenario = page.getByRole('textbox', { name: 'Hypothetical adjusted rate', exact: true });
    await scenario.fill('8.5');
    await expect(page.getByText('Scenario · month 85', { exact: true })).toBeVisible();
    await expect(page.getByText(/Not a forecast/)).toBeVisible();
    await years.blur();
    await years.click();
    await expect.poll(() => years.evaluate(e => [e.selectionStart, e.selectionEnd])).toEqual([0, 2]);
    await page.keyboard.type('22');
    await expect(years).toHaveValue('22');
    await page.getByRole('button', { name: 'Apply term', exact: true }).click();
    await advanced.click();
    await expect(page.getByText('7/1 ARM · 22-year term', { exact: true })).toHaveCount(0);
    await page.waitForTimeout(500);
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByText('7/1 ARM · 22-year term', { exact: true })).toHaveCount(0);
    await advanced.click();
    await expect(page.getByText('7/1 ARM · 22-year term', { exact: true })).toBeVisible();
    await expect(scenario).toHaveValue('8.5');
    for (const period of [5, 10, 7]) {
      await page.getByRole('button', { name: `${period}/1 ARM`, exact: true }).click();
      await expect(page.getByText(`Scenario · month ${period * 12 + 1}`, { exact: true })).toBeVisible();
    }
    await page.getByRole('button', { name: 'Fixed rate', exact: true }).click();
    await expect(page.getByText('Estimated monthly payment', { exact: true })).toBeVisible();
    await expect(page.getByText('Initial estimated monthly payment', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Adjustable rate', exact: true }).click();
    for (const width of [320, 390, 1100]) {
      await page.setViewportSize({ width, height: 1100 });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    await page.setViewportSize({ width: 1100, height: 1500 });
    await advanced.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'verification-advanced-loans.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 2000 });
    await page.screenshot({ path: 'verification-advanced-loans-phone.png', fullPage: true });
    // Corrupt/incompatible saved options must not resurrect an impossible ARM.
    await page.evaluate(() => localStorage.setItem('loanglow:last-inputs:v1', JSON.stringify({ termYears: 5, loanType: 'arm', armPeriod: 7 })));
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByText('Estimated monthly payment', { exact: true })).toBeVisible();
    await expect(page.getByText('30 years', { exact: true })).toBeVisible();
    await advanced.click();
    await expect(page.getByText('5 years', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Adjustable rate', exact: true }).click();
    await expect(page.getByText(/Choose a term longer than 7 years/)).toBeVisible();
    await expect(page.getByText('Initial estimated monthly payment', { exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
    console.log('PASS: custom terms, all ARM choices, first-reset scenario, invalid terms, selection, persistence, and responsive layout');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
