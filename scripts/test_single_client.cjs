const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1366,768']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });

  console.log('Logging in...');
  await page.goto('https://ops.faseehlall.com/login', { waitUntil: 'networkidle2' });
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.type('input[type="email"]', 'qa.owner.2fa@faseehlall.com');
  await page.type('input[type="password"]', 'QA2FAPassword2026!#');
  await page.click('button[type="submit"]');
  await sleep(3500);

  const clients = [
    { name: 'Finfix Pro', id: '5d585580-d378-44a5-8dc1-d2653d4d6d8a' },
    { name: 'Odiii', id: '228887a4-3626-40ab-81bc-4fd61548cfb7' },
    { name: 'Maven Professionals', id: '8e5d17bf-1ba9-41e1-9ef7-09ca137a72d3' },
    { name: 'Pixel Algos', id: '5b9ea614-9b21-4b26-9c17-a8fa98b451c8' },
    { name: 'Cloud Z Technologies', id: 'd3d666c2-24c7-4cc7-b879-55c6d5881185' }
  ];

  for (const c of clients) {
    console.log(`\nNavigating to ${c.name}...`);
    await page.goto(`https://ops.faseehlall.com/clients/${c.id}?preview=true`, { waitUntil: 'networkidle2' });
    await sleep(3500);

    const check = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        url: window.location.href,
        has30DaySetup: text.includes('30-Day Setup'),
        has90DayWorkPlans: text.includes('90-Day Work Plans'),
        hasClientDetails: text.includes('Client Details'),
        hasMonthlyReports: text.includes('Monthly Reports'),
        hasDashboardTab: Array.from(document.querySelectorAll('button')).some(b => b.textContent?.trim() === 'Dashboard'),
        hasPerformanceOverview: text.includes('Performance Overview'),
        hasMarketingChannels: text.includes('Marketing Channels'),
        hasAddTask: Array.from(document.querySelectorAll('button')).some(b => b.textContent?.includes('Add Task'))
      };
    });
    console.log(`${c.name} check:`, check);
  }

  await browser.close();
})();
