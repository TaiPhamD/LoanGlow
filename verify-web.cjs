const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 1100 } });
  const messages = [];
  page.on('console', msg => messages.push(`${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => messages.push(`pageerror: ${err.message}`));
  await page.goto('http://localhost:8081', { waitUntil: 'networkidle', timeout: 60000 });
  const title = await page.locator('text=LoanGlow').first().textContent();
  const payment = await page.locator('text=Estimated monthly payment').first().textContent();
  await page.screenshot({ path: 'verification-loanglow.png', fullPage: true });
  console.log(JSON.stringify({ ok: true, title, paymentLabel: payment, consoleMessages: messages }, null, 2));
  await browser.close();
})();
