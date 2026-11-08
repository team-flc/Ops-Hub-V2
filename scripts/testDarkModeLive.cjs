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

  // Toggle Dark Mode via header button or document.documentElement
  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
  });
  await new Promise(r => setTimeout(r, 1000));

  const darkStyles = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="stat-project-completion"]');
    const bg = window.getComputedStyle(card).backgroundColor;
    const color = window.getComputedStyle(card).color;
    const bodyBg = window.getComputedStyle(document.body).backgroundColor;
    const htmlClasses = document.documentElement.className;
    return { bg, color, bodyBg, htmlClasses };
  });

  console.log('Computed styles in dark mode:', darkStyles);

  await page.screenshot({ path: `${ARTIFACT_DIR}/verify_live_dark_mode_test.png`, fullPage: false });
  console.log('Saved verify_live_dark_mode_test.png');

  await browser.close();
})().catch(console.error);
