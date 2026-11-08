const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  console.log('=== Verifying Multi-Tenant & Role Isolation on Live Production ===');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1366,768']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });

  // 1. Log in as QA Owner
  await page.goto('https://ops.faseehlall.com/login', { waitUntil: 'networkidle2' });
  await page.waitForSelector('input[type="email"]');
  await page.type('input[type="email"]', 'qa.owner.2fa@faseehlall.com');
  await page.type('input[type="password"]', 'QA2FAPassword2026!#');
  await page.click('button[type="submit"]');
  await sleep(3500);

  // 2. In client preview mode, verify that owner dashboard elements do NOT appear
  await page.goto('https://ops.faseehlall.com/clients/5d585580-d378-44a5-8dc1-d2653d4d6d8a?preview=true', { waitUntil: 'networkidle2' });
  await sleep(3000);

  const previewCheck = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      hasOwnerGreeting: text.includes('Good morning, Faseeh Lall') || text.includes('Good afternoon, Faseeh Lall'),
      hasTeamReviewSection: text.includes('Team Review') && text.includes('Waiting for management'),
      hasEmployeeOperations: text.includes('Employee Operations'),
      url: window.location.href
    };
  });
  console.log('Preview mode isolation check:', previewCheck);

  // 3. In staff view (no preview), verify staff header and controls ARE visible
  await page.goto('https://ops.faseehlall.com/clients/5d585580-d378-44a5-8dc1-d2653d4d6d8a', { waitUntil: 'networkidle2' });
  await sleep(3000);

  const staffCheck = await page.evaluate(() => {
    const addTaskBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Add Task'));
    return {
      hasAddTaskBtn: Boolean(addTaskBtn && addTaskBtn.offsetParent !== null),
      url: window.location.href
    };
  });
  console.log('Staff mode verification check:', staffCheck);

  await browser.close();
  console.log('Multi-tenant check completed successfully.');
})();
