const puppeteer = require('puppeteer-core');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\Atif\\.gemini\\antigravity\\brain\\dc6b2411-97c2-4334-900a-7f5e6445dbb3';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  console.log('--- Starting Live Production Verification on ops.faseehlall.com ---');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Login
  console.log('1. Navigating to login...');
  await page.goto('https://ops.faseehlall.com/login', { waitUntil: 'networkidle2' });
  await page.waitForSelector('input[type="email"]');
  await page.type('input[type="email"]', 'qa.owner.2fa@faseehlall.com');
  await page.type('input[type="password"]', 'QA2FAPassword2026!#');
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });

  // 2. Wait for Cloudflare Pages deployment to settle if needed
  console.log('2. Waiting 30s for production deployment...');
  await sleep(30000);

  // 3. Navigate to Finfix Pro View Client
  console.log('3. Navigating to Finfix Pro View Client...');
  await page.goto('https://ops.faseehlall.com/clients/5d585580-d378-44a5-8dc1-d2653d4d6d8a?preview=true', { waitUntil: 'networkidle2' });
  await sleep(4000);

  // Check portal elements
  const portalData = await page.evaluate(() => {
    const header = document.querySelector('[data-testid="finfix-client-header"]');
    const statCards = [
      document.querySelector('[data-testid="stat-project-completion"]')?.innerText,
      document.querySelector('[data-testid="stat-tasks-completed"]')?.innerText,
      document.querySelector('[data-testid="stat-pending-approvals"]')?.innerText,
      document.querySelector('[data-testid="stat-subscription"]')?.innerText
    ];
    const perfSection = document.querySelector('[data-testid="performance-overview-section"]');
    const svgChart = perfSection?.querySelector('svg');
    const projectProgress = document.querySelector('[data-testid="project-progress-section"]');
    const subCard = document.querySelector('[data-testid="subscription-billing-card"]');
    const recentAct = document.querySelector('[data-testid="recent-activity-section"]');
    const mktgDonut = document.querySelector('[data-testid="marketing-channels-section"]');
    const bottomBar = document.querySelector('[data-testid="client-portal-bottom-bar"]');

    return {
      headerText: header?.innerText,
      statCards,
      hasSvgChart: !!svgChart,
      hasProjectProgress: !!projectProgress,
      hasSubscriptionCard: !!subCard,
      hasRecentActivity: !!recentAct,
      hasMarketingChannels: !!mktgDonut,
      hasBottomBar: !!bottomBar
    };
  });

  console.log('Finfix Pro Portal Live State:', JSON.stringify(portalData, null, 2));

  // Take screenshot of live dashboard
  await page.screenshot({
    path: `${ARTIFACT_DIR}/verify_live_aligned_dashboard.png`,
    fullPage: false
  });
  console.log('Saved verify_live_aligned_dashboard.png');

  // Full page screenshot
  await page.screenshot({
    path: `${ARTIFACT_DIR}/verify_live_aligned_dashboard_full.png`,
    fullPage: true
  });
  console.log('Saved verify_live_aligned_dashboard_full.png');

  // 4. Test Maven Professionals
  console.log('4. Checking Maven Professionals...');
  await page.goto('https://ops.faseehlall.com/clients/8e5d17bf-1ba9-41e1-9ef7-09ca137a72d3?preview=true', { waitUntil: 'networkidle2' });
  await sleep(3000);
  await page.screenshot({
    path: `${ARTIFACT_DIR}/verify_live_maven_aligned.png`,
    fullPage: false
  });
  console.log('Saved verify_live_maven_aligned.png');

  // 5. Test Pixel Algos
  console.log('5. Checking Pixel Algos...');
  await page.goto('https://ops.faseehlall.com/clients/5b9ea614-9b21-4b26-9c17-a8fa98b451c8?preview=true', { waitUntil: 'networkidle2' });
  await sleep(3000);
  await page.screenshot({
    path: `${ARTIFACT_DIR}/verify_live_pixel_aligned.png`,
    fullPage: false
  });
  console.log('Saved verify_live_pixel_aligned.png');

  // 6. Test Archived client Books2Clear
  console.log('6. Checking Archived Client Books2Clear...');
  await page.goto('https://ops.faseehlall.com/clients/753a7220-117e-448c-810c-0aee3da6b15c?preview=true', { waitUntil: 'networkidle2' });
  await sleep(3000);
  const archivedData = await page.evaluate(() => {
    return {
      hasDashboardTab: !!document.querySelector('[data-testid="tab-dashboard"]'),
      bannerText: document.querySelector('[data-testid="client-portal-banner"]')?.innerText
    };
  });
  console.log('Archived Client Books2Clear State:', JSON.stringify(archivedData, null, 2));

  console.log('--- Production Verification Finished Successfully ---');
  await browser.close();
})().catch(console.error);
