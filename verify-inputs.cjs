const { chromium, expect } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 1100 } });
    await page.goto('http://localhost:8081', { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByText('Property tax details', { exact: true }).click();
    await page.getByText('Use manual tax rate', { exact: true }).click();
    const inputs = page.locator('input');
    await inputs.nth(6).fill('1.25');
    for (let i = 0; i < 7; i += 1) {
      const input = inputs.nth(i);
      await input.blur();
      const original = await input.inputValue();
      await input.click();
      await expect.poll(() => input.evaluate(el => [el.selectionStart, el.selectionEnd])).toEqual([0, original.length]);
      await page.keyboard.type('2');
      await expect(input).toHaveValue('2');
      // Subsequent clicks while focused must permit caret placement, not reselect.
      await input.fill('123');
      await input.press('ArrowLeft');
      await expect.poll(() => input.evaluate(el => el.selectionStart === el.selectionEnd)).toBe(true);
    }
    await inputs.nth(0).blur();
    await inputs.nth(0).focus();
    await expect.poll(() => inputs.nth(0).evaluate(el => [el.selectionStart, el.selectionEnd])).toEqual([0, 3]);
    console.log('PASS: all 7 fields select all on focus and allow quick replacement/caret editing');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
