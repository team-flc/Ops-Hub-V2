const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function test() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto('https://ops.faseehlall.com/login', { waitUntil: 'networkidle2' });
  await page.waitForSelector('input#work-email');
  await page.type('input#work-email', 'qa.owner.2fa@faseehlall.com');
  await page.type('input#password', 'QA2FAPassword2026!#');
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 4000));
  console.log('Current URL after login:', page.url());

  const content = await page.evaluate(() => document.body.innerText);
  console.log('Page snippet:', content.slice(0, 400).replace(/\n/g, ' '));
  await browser.close();
}
test();
