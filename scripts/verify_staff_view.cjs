const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto('https://ops.faseehlall.com/login', { waitUntil: 'networkidle2' });
  await page.waitForSelector('input[type="email"]');
  await page.type('input[type="email"]', 'qa.owner.2fa@faseehlall.com');
  await page.type('input[type="password"]', 'QA2FAPassword2026!#');
  await page.click('button[type="submit"]');
  await new Promise(r => setTimeout(r, 4000));

  // Visit Finfix Pro staff view without preview
  await page.goto('https://ops.faseehlall.com/clients/5d585580-d378-44a5-8dc1-d2653d4d6d8a', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 3500));

  const staffData = await page.evaluate(() => {
    const bodyText = document.body.innerText;
    const tabButtons = Array.from(document.querySelectorAll('button[data-testid^="tab-"]')).map(b => ({
      testid: b.getAttribute('data-testid'),
      text: b.textContent?.trim(),
      isActive: b.className.includes('bg-brand-500')
    }));
    const addTaskBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Add Task'));
    return {
      tabButtons,
      isAddTaskPresent: !!addTaskBtn,
      hasMonthlyReports: bodyText.includes('Monthly Reports')
    };
  });

  console.log('Staff View Verification:', JSON.stringify(staffData, null, 2));
  await browser.close();
})();
