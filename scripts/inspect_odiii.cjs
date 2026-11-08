const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new'
  });
  const page = await browser.newPage();
  await page.goto('https://ops.faseehlall.com/login', { waitUntil: 'networkidle2' });
  await page.type('input[type="email"]', 'qa.owner.2fa@faseehlall.com');
  await page.type('input[type="password"]', 'QA2FAPassword2026!#');
  await page.click('button[type="submit"]');
  await new Promise(r => setTimeout(r, 2500));

  await page.goto('https://ops.faseehlall.com/clients/228887a4-3626-40ab-81bc-4fd61548cfb7?preview=true', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 3000));

  const url = page.url();
  const text = await page.evaluate(() => document.body.innerText);
  console.log('Current URL:', url);
  console.log('Body text snippet:\n', text.slice(0, 500));
  await browser.close();
})();
