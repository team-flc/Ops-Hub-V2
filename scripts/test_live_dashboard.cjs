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
  await new Promise(r => setTimeout(r, 3000));

  console.log('Navigating to /settings/dashboard...');
  await page.goto('https://ops.faseehlall.com/settings/dashboard', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 4000));

  const workloadItems = await page.evaluate(() => {
    // Find the container for Client Operational Workload Distribution
    const headers = Array.from(document.querySelectorAll('h3'));
    const workloadHeader = headers.find(h => h.innerText.includes('Client Operational Workload Distribution'));
    if (!workloadHeader) return [];
    const container = workloadHeader.closest('.p-5, .p-6') || workloadHeader.parentElement;
    const cards = Array.from(container.querySelectorAll('.p-3\\.5, .rounded-2xl'));
    return cards.map(c => c.innerText.replace(/\n/g, ' '));
  });

  console.log('Found workload items:', workloadItems.length);
  const targetClients = ['Cloud Z Technologies', 'Solid BooksLLC', 'Bizease', 'Faseeh Lall & Co'];
  targetClients.forEach(name => {
    const item = workloadItems.find(i => i.includes(name));
    console.log(`${name}:`, item || 'NOT FOUND');
  });

  await browser.close();
}
test();
