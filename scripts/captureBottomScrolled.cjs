const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\Atif\\.gemini\\antigravity\\brain\\dc6b2411-97c2-4334-900a-7f5e6445dbb3';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  await page.goto('https://ops.faseehlall.com/login', { waitUntil: 'networkidle2' });
  await page.waitForSelector('input[type="email"]');
  await page.type('input[type="email"]', 'qa.owner.2fa@faseehlall.com');
  await page.type('input[type="password"]', 'QA2FAPassword2026!#');
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });

  // Navigate to Finfix Pro View Client
  await page.goto('https://ops.faseehlall.com/clients/5d585580-d378-44a5-8dc1-d2653d4d6d8a?preview=true', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 4000));

  // Find scrollable element and scroll to bottom
  const scrollInfo = await page.evaluate(() => {
    let scrolledAny = false;
    const all = Array.from(document.querySelectorAll('*'));
    for (const el of all) {
      if (el.scrollHeight > el.clientHeight + 50 && el.clientHeight > 200) {
        el.scrollTop = el.scrollHeight;
        scrolledAny = true;
      }
    }
    window.scrollTo(0, document.body.scrollHeight);
    return scrolledAny;
  });

  console.log('Scrolled elements:', scrollInfo);
  await new Promise(r => setTimeout(r, 1000));

  await page.screenshot({ path: `${ARTIFACT_DIR}/verify_live_scrolled_bottom.png`, fullPage: false });
  console.log('Saved verify_live_scrolled_bottom.png');

  await browser.close();
})().catch(console.error);
