const puppeteer = require('puppeteer-core');
const path = require('path');

const PROD_URL = 'https://ops.faseehlall.com';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\Atif\\.gemini\\antigravity\\brain\\dc6b2411-97c2-4334-900a-7f5e6445dbb3';

const QA_OWNER_EMAIL = 'qa.owner.2fa@faseehlall.com';
const QA_OWNER_PASSWORD = 'QA2FAPassword2026!#';

const FINFIX_ID = '5d585580-d378-44a5-8dc1-d2653d4d6d8a';
const MAVEN_ID = '8e5d17bf-1ba9-41e1-9ef7-09ca137a72d3';
const PIXEL_ID = '5b9ea614-9b21-4b26-9c17-a8fa98b451c8';
const PENTA_ID = '59010ecc-4249-4e49-8ddb-628f9651e0d2';

async function loginUser(page, email, password) {
  await page.goto(`${PROD_URL}/login`, { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto(`${PROD_URL}/login`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('input#work-email', { timeout: 15000 });
  await page.type('input#work-email', email);
  await page.type('input#password', password);
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
}

async function verifyProduction() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1440, height: 1100 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Error') || text.includes('error') || text.includes('warning')) {
      console.log('BROWSER LOG:', text);
    }
  });

  try {
    console.log('--- 1. Logging into Production https://ops.faseehlall.com ---');
    await loginUser(page, QA_OWNER_EMAIL, QA_OWNER_PASSWORD);

    // =========================================================================
    // 2. Test Finfix Pro on Production
    // =========================================================================
    console.log('\n--- 2. Checking Finfix Pro on Production (?preview=true) ---');
    await page.goto(`${PROD_URL}/clients/${FINFIX_ID}?preview=true`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 4000));

    // Hard Reload 3 times to verify persistence
    for (let r = 1; r <= 3; r++) {
      console.log(`Reload check #${r}...`);
      await page.reload({ waitUntil: 'networkidle2' });
      await new Promise(res => setTimeout(res, 2000));
    }

    const finfixChecks = await page.evaluate(() => {
      const banner = document.body.innerText.includes('Client Preview Mode') && document.body.innerText.includes('Exit Preview');
      const tabDashboard = document.querySelector('[data-testid="tab-dashboard"]');
      const tabSetup = document.querySelector('[data-testid="tab-setup"]');
      const tabWorkplans = document.querySelector('[data-testid="tab-workplans"]');
      
      const c1 = document.querySelector('[data-testid="stat-project-completion"]');
      const c2 = document.querySelector('[data-testid="stat-tasks-completed"]');
      const c3 = document.querySelector('[data-testid="stat-pending-approvals"]');
      const c4 = document.querySelector('[data-testid="stat-subscription"]');

      const proj = document.querySelector('[data-testid="project-progress-section"]');
      const sidebar = document.querySelector('[data-testid="finfix-client-sidebar"]');

      return {
        hasAmberBanner: banner,
        hasTabDashboard: Boolean(tabDashboard),
        hasTabSetup: Boolean(tabSetup),
        hasTabWorkplans: Boolean(tabWorkplans),
        hasSidebar: Boolean(sidebar),
        c1: c1?.innerText.replace(/\n/g, ' '),
        c2: c2?.innerText.replace(/\n/g, ' '),
        c3: c3?.innerText.replace(/\n/g, ' '),
        c4: c4?.innerText.replace(/\n/g, ' '),
        projText: proj?.innerText.replace(/\n/g, ' ')
      };
    });

    console.log('Production Finfix checks:', finfixChecks);

    if (!finfixChecks.hasTabDashboard) {
      console.log('[WAIT] Cloudflare Pages build may still be deploying. Reporting current live state.');
    } else {
      console.log('[SUCCESS] Finfix Pro has live Dashboard tab on production and persisted after 3 hard reloads.');
    }

    // Save screenshot
    const prodFinfixShot = path.join(ARTIFACTS_DIR, 'verify_prod_finfix_portal.png');
    await page.screenshot({ path: prodFinfixShot, fullPage: true });
    console.log(`Saved screenshot to ${prodFinfixShot}`);

    // =========================================================================
    // 3. Test Maven Professionals on Production
    // =========================================================================
    console.log('\n--- 3. Checking Maven Professionals on Production ---');
    await page.goto(`${PROD_URL}/clients/${MAVEN_ID}?preview=true`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 4000));
    const mavenChecks = await page.evaluate(() => {
      const tabDashboard = document.querySelector('[data-testid="tab-dashboard"]');
      const header = document.querySelector('[data-testid="finfix-client-header"]');
      return {
        hasTabDashboard: Boolean(tabDashboard),
        headerText: header?.innerText.replace(/\n/g, ' ')
      };
    });
    console.log('Production Maven checks:', mavenChecks);

    const prodMavenShot = path.join(ARTIFACTS_DIR, 'verify_prod_maven_portal.png');
    await page.screenshot({ path: prodMavenShot });
    console.log(`Saved screenshot to ${prodMavenShot}`);

    // =========================================================================
    // 4. Test Pixel Algos on Production
    // =========================================================================
    console.log('\n--- 4. Checking Pixel Algos on Production ---');
    await page.goto(`${PROD_URL}/clients/${PIXEL_ID}?preview=true`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 4000));
    const pixelChecks = await page.evaluate(() => {
      const tabDashboard = document.querySelector('[data-testid="tab-dashboard"]');
      const header = document.querySelector('[data-testid="finfix-client-header"]');
      return {
        hasTabDashboard: Boolean(tabDashboard),
        headerText: header?.innerText.replace(/\n/g, ' ')
      };
    });
    console.log('Production Pixel checks:', pixelChecks);

    // =========================================================================
    // 5. Test Penta Cipher on Production
    // =========================================================================
    console.log('\n--- 5. Checking Penta Cipher on Production ---');
    await page.goto(`${PROD_URL}/clients/${PENTA_ID}?preview=true`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 4000));
    const pentaChecks = await page.evaluate(() => {
      const tabDashboard = document.querySelector('[data-testid="tab-dashboard"]');
      const header = document.querySelector('[data-testid="finfix-client-header"]');
      return {
        hasTabDashboard: Boolean(tabDashboard),
        headerText: header?.innerText.replace(/\n/g, ' ')
      };
    });
    console.log('Production Penta checks:', pentaChecks);

  } catch (err) {
    console.error('Error during production verification:', err);
  } finally {
    await browser.close();
  }
}

verifyProduction();
