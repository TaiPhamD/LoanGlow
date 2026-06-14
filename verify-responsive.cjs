const { chromium } = require('@playwright/test');

async function snapshotFor(page, width, height) {
  await page.setViewportSize({ width, height });
  await page.goto('http://localhost:8081', { waitUntil: 'networkidle', timeout: 60000 });
  const body = await page.locator('body').innerText();
  const loanBox = await page.getByText('Loan details').boundingBox();
  const summaryBox = await page.getByText('Estimated monthly payment').boundingBox();
  if (!loanBox || !summaryBox) throw new Error(`Missing core sections at ${width}x${height}`);
  return {
    width,
    height,
    hasTitle: body.includes('LoanGlow'),
    hasPayment: body.includes('Estimated monthly payment'),
    loanX: Math.round(loanBox.x),
    loanY: Math.round(loanBox.y),
    summaryX: Math.round(summaryBox.x),
    summaryY: Math.round(summaryBox.y),
  };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  const phone = await snapshotFor(page, 390, 1100);
  await page.screenshot({ path: 'verification-phone-portrait.png', fullPage: true });
  const landscape = await snapshotFor(page, 1100, 700);
  await page.screenshot({ path: 'verification-tablet-landscape.png', fullPage: true });
  const ipad = await snapshotFor(page, 1366, 1024);
  await page.screenshot({ path: 'verification-ipad-landscape.png', fullPage: true });

  const phoneStacks = phone.summaryY > phone.loanY + 200;
  const landscapeTwoPane = landscape.summaryX > landscape.loanX + 300 && Math.abs(landscape.summaryY - landscape.loanY) < 120;
  const ipadTwoPane = ipad.summaryX > ipad.loanX + 300 && Math.abs(ipad.summaryY - ipad.loanY) < 120;
  const ok = phone.hasTitle && phone.hasPayment && phoneStacks && landscapeTwoPane && ipadTwoPane && errors.length === 0;

  console.log(JSON.stringify({ ok, phone, landscape, ipad, phoneStacks, landscapeTwoPane, ipadTwoPane, errors }, null, 2));
  await browser.close();
  if (!ok) process.exit(1);
})();
