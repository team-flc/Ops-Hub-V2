const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new' });
  const page = await browser.newPage();
  await page.goto('https://ops.faseehlall.com/login', { waitUntil: 'networkidle2' });
  await page.type('input[type="email"]', 'qa.owner.2fa@faseehlall.com');
  await page.type('input[type="password"]', 'QA2FAPassword2026!#');
  await page.click('button[type="submit"]');
  await new Promise(r => setTimeout(r, 3000));
  await page.goto('https://ops.faseehlall.com/clients/d3d666c2-24c7-4cc7-b879-55c6d5881185', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 4000));
  const res = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    return {
      asideText: aside ? aside.innerText : 'NO ASIDE',
      url: window.location.href
    };
  });
  console.log('URL:', res.url);
  console.log('Aside text:', res.asideText);
  await browser.close();
})();
