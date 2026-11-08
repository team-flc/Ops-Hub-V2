const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  await page.goto('https://ops.faseehlall.com/login', { waitUntil: 'networkidle2' });
  await page.type('input[type="email"]', 'qa.owner.2fa@faseehlall.com');
  await page.type('input[type="password"]', 'QA2FAPassword2026!#');
  await page.click('button[type="submit"]');
  await new Promise(r => setTimeout(r, 3000));

  await page.goto('https://ops.faseehlall.com/clients/d3d666c2-24c7-4cc7-b879-55c6d5881185', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  const linkData = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[data-testid*="sidebar-link-"]')).map(el => ({
      testId: el.getAttribute('data-testid'),
      text: el.innerText.trim()
    }));
  });

  console.log('Total links found on Cloud Z:', linkData.length);
  console.log('Last 6 links:', linkData.slice(-6));
  await browser.close();
})();
