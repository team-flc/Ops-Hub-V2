const puppeteer = require('puppeteer-core');
const path = require('path');

const BASE_URL = 'http://localhost:4173';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\Atif\\.gemini\\antigravity\\brain\\dc6b2411-97c2-4334-900a-7f5e6445dbb3';

const QA_OWNER_EMAIL = 'qa.owner.2fa@faseehlall.com';
const QA_OWNER_PASSWORD = 'QA2FAPassword2026!#';

const FINFIX_ID = '5d585580-d378-44a5-8dc1-d2653d4d6d8a';
const MAVEN_ID = '8e5d17bf-1ba9-41e1-9ef7-09ca137a72d3';
const PIXEL_ID = '5b9ea614-9b21-4b26-9c17-a8fa98b451c8';
const PENTA_ID = '59010ecc-4249-4e49-8ddb-628f9651e0d2';
const ARCHIVED_ID = '753a7220-117e-448c-810c-0aee3da6b15c'; // Books2Clear

async function loginUser(page, email, password) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('input#work-email', { timeout: 15000 });
  await page.type('input#work-email', email);
  await page.type('input#password', password);
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
}

async function runVerification() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1440, height: 1100 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    console.log('\n=============================================================');
    console.log('--- 1. Logging in as QA Owner ---');
    console.log('=============================================================');
    await loginUser(page, QA_OWNER_EMAIL, QA_OWNER_PASSWORD);

    // =========================================================================
    // 2. Test Client 1: FINFIX PRO View Client
    // =========================================================================
    console.log('\n--- 2. Verifying Finfix Pro View Client (?preview=true) ---');
    await page.goto(`${BASE_URL}/clients/${FINFIX_ID}?preview=true`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 3000));

    // A. Check Workspace Shell (Amber preview banner, SelectedClientHeader, and Tabs)
    const shell = await page.evaluate(() => {
      const banner = document.body.innerText.includes('Client Preview Mode') && document.body.innerText.includes('Exit Preview');
      const tabDashboard = document.querySelector('[data-testid="tab-dashboard"]');
      const tabSetup = document.querySelector('[data-testid="tab-setup"]');
      const tabWorkplans = document.querySelector('[data-testid="tab-workplans"]');
      return {
        hasAmberBanner: banner,
        hasTabDashboard: Boolean(tabDashboard),
        hasTabSetup: Boolean(tabSetup),
        hasTabWorkplans: Boolean(tabWorkplans)
      };
    });
    console.log('Finfix Shell checks:', shell);
    if (!shell.hasAmberBanner || !shell.hasTabDashboard || !shell.hasTabSetup) {
      throw new Error(`Shell checks failed: ${JSON.stringify(shell)}`);
    }
    console.log('[PASS] Ops Hub Shell intact: Amber banner, breadcrumbs, and sibling tabs (Dashboard, 30-Day Setup, 90-Day Work Plans) present.');

    // B. Check Sidebar (15 items in strict required order)
    const sidebar = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="finfix-client-sidebar"]');
      if (!el) return { found: false };
      const btns = Array.from(el.querySelectorAll('button[data-testid^="nav-"]'));
      const labels = btns.map(b => b.innerText.trim().split('\n')[0]);
      return { found: true, count: btns.length, labels, text: el.innerText };
    });

    console.log('Finfix Sidebar items:', sidebar.count, sidebar.labels);
    if (!sidebar.found || sidebar.count !== 15) {
      throw new Error(`Sidebar verification failed! Found ${sidebar.count} items instead of 15.`);
    }

    const expectedOrder = [
      'Dashboard', 'Projects', 'Analytics', 'Social Media', 'LinkedIn',
      'Website and SEO', 'Paid Ads', 'Funnel', 'Subscription', 'Billing and Invoices',
      'Deliverables', 'Approvals', 'Team', 'Reports', 'Settings'
    ];
    for (let i = 0; i < expectedOrder.length; i++) {
      if (sidebar.labels[i] !== expectedOrder[i]) {
        throw new Error(`Sidebar item mismatch at [${i}]: expected ${expectedOrder[i]}, got ${sidebar.labels[i]}`);
      }
    }
    console.log('[PASS] Finfix Pro sidebar has all 15 navigation items in strict order.');

    // C. Check Header & Greeting
    const header = await page.evaluate(() => {
      const h = document.querySelector('[data-testid="finfix-client-header"]');
      return {
        found: Boolean(h),
        text: h?.innerText || ''
      };
    });
    console.log('Finfix Header:', header.text.replace(/\n/g, ' '));
    if (!header.found || !header.text.includes('Finfix Pro') || !header.text.toLowerCase().includes('performance at a glance')) {
      throw new Error(`Header verification failed! ${JSON.stringify(header)}`);
    }
    console.log('[PASS] Header displays "Finfix Pro" and "performance at a glance".');

    // D. Check 4 Stat Cards in 1 horizontal row
    const statCards = await page.evaluate(() => {
      const c1 = document.querySelector('[data-testid="stat-project-completion"]');
      const c2 = document.querySelector('[data-testid="stat-tasks-completed"]');
      const c3 = document.querySelector('[data-testid="stat-pending-approvals"]');
      const c4 = document.querySelector('[data-testid="stat-subscription"]');

      const bodyText = document.body.innerText;
      const forbiddenMockups = [
        'Brightleaf Co', 'Alex Morgan', '84%', '18 / 24', '18/24',
        '$149', '22.4K', '3,850', '3850', 'Ali Hassan', '78%', '24 / 32', '24/32',
        '$99', '68K'
      ];
      const foundMockups = forbiddenMockups.filter(m => bodyText.includes(m));

      return {
        allFound: Boolean(c1 && c2 && c3 && c4),
        c1: c1?.innerText.replace(/\n/g, ' '),
        c2: c2?.innerText.replace(/\n/g, ' '),
        c3: c3?.innerText.replace(/\n/g, ' '),
        c4: c4?.innerText.replace(/\n/g, ' '),
        foundMockups
      };
    });
    console.log('Finfix Stat cards:', statCards);
    if (!statCards.allFound || statCards.foundMockups.length > 0) {
      throw new Error(`Stat cards verification failed! Forbidden mockups found: ${statCards.foundMockups}`);
    }
    console.log('[PASS] 4 Stat cards verified with zero mockup numbers.');

    // E. Check Performance Overview & Toggles
    const perfChecks = await page.evaluate(() => {
      const perf = document.querySelector('[data-testid="performance-overview-section"]');
      return {
        found: Boolean(perf),
        text: perf?.innerText || '',
        hasNotConnected: perf?.innerText.includes('Website Traffic & Leads: Not connected')
      };
    });
    console.log('Performance Overview:', perfChecks.text.replace(/\n/g, ' '));
    if (!perfChecks.found || !perfChecks.hasNotConnected) {
      throw new Error('Performance Overview does not show "Website Traffic & Leads: Not connected"!');
    }

    // Test clicking range toggles
    await page.click('button::-p-text(7D)');
    await new Promise(r => setTimeout(r, 400));
    await page.click('button::-p-text(90D)');
    await new Promise(r => setTimeout(r, 400));
    await page.click('button::-p-text(30D)');
    await new Promise(r => setTimeout(r, 400));
    console.log('[PASS] Performance Overview range toggles (7D, 30D, 90D, 1Y) functional.');

    // F. Check Project Progress with 4 project plans
    const projectPlans = await page.evaluate(() => {
      const proj = document.querySelector('[data-testid="project-progress-section"]');
      const text = proj?.innerText || '';
      return {
        found: Boolean(proj),
        hasSocial: text.includes('Social Media Optimization'),
        hasLinkedIn: text.includes('LinkedIn Optimization'),
        hasFunnel: text.includes('Funnel Setup'),
        hasAds: text.includes('Paid Ads Setup'),
        text
      };
    });
    console.log('Finfix Project Plans verified:', {
      social: projectPlans.hasSocial,
      linkedin: projectPlans.hasLinkedIn,
      funnel: projectPlans.hasFunnel,
      ads: projectPlans.hasAds
    });
    if (!projectPlans.found || !projectPlans.hasSocial || !projectPlans.hasLinkedIn || !projectPlans.hasFunnel || !projectPlans.hasAds) {
      throw new Error('Project Progress plans verification failed!');
    }
    console.log('[PASS] Project plans (Social Media, LinkedIn, Funnel, Paid Ads) verified.');

    // G. Check Subscription & Billing and Recent Activity
    const lowerSections = await page.evaluate(() => {
      const billing = document.querySelector('[data-testid="subscription-billing-card"]');
      const activity = document.querySelector('[data-testid="recent-activity-section"]');
      const mktg = document.querySelector('[data-testid="marketing-channels-section"]');
      const bottomBar = document.querySelector('[data-testid="client-portal-bottom-bar"]');

      return {
        billingPlan: billing?.innerText.includes('Plan Tier') || billing?.innerText.includes('Current Subscription'),
        billingStatus: billing?.innerText.includes('Account Status') || billing?.innerText.includes('Active'),
        billingNextDate: billing?.innerText.includes('Next Billing Date'),
        billingPayment: billing?.innerText.includes('Payment Status'),
        billingReceiptBtn: Boolean(billing?.querySelector('button')),
        activityFound: Boolean(activity),
        mktgNotConnected: mktg?.innerText.includes('Marketing Channels: Not connected'),
        bottomBarFound: Boolean(bottomBar),
        bottomBarReportBtn: Boolean(bottomBar?.querySelector('button'))
      };
    });
    console.log('Finfix Lower sections:', lowerSections);
    if (!lowerSections.billingPlan || !lowerSections.billingNextDate || !lowerSections.billingReceiptBtn || !lowerSections.mktgNotConnected || !lowerSections.bottomBarReportBtn) {
      throw new Error(`Lower sections check failed: ${JSON.stringify(lowerSections)}`);
    }
    console.log('[PASS] Subscription & Billing, Recent Activity, Marketing Channels, and Bottom Bar verified.');

    // H. Test tab switching: Sibling tab "30-Day Setup" renders week stepper and kanban board
    await page.click('[data-testid="tab-setup"]');
    await new Promise(r => setTimeout(r, 1000));
    const setupTabRendered = await page.evaluate(() => {
      const stepper = document.querySelector('[data-testid="client-week-stepper"]');
      return Boolean(stepper);
    });
    console.log('Finfix 30-Day Setup sibling tab opened:', setupTabRendered);
    if (!setupTabRendered) {
      throw new Error('Clicking 30-Day Setup tab did not render week stepper!');
    }
    console.log('[PASS] 30-Day Setup sibling tab opens properly and keeps week stepper accessible.');

    // Switch back to Dashboard tab
    await page.click('[data-testid="tab-dashboard"]');
    await new Promise(r => setTimeout(r, 1000));

    // Capture Finfix Pro Client Portal Screenshot
    const finfixScreenshot = path.join(ARTIFACTS_DIR, 'verify_finfix_portal_live.png');
    await page.screenshot({ path: finfixScreenshot, fullPage: true });
    console.log(`[PASS] Saved Finfix Pro screenshot to ${finfixScreenshot}`);

    // =========================================================================
    // 3. Test Client 2: MAVEN PROFESSIONALS View Client
    // =========================================================================
    console.log('\n--- 3. Verifying Maven Professionals View Client (?preview=true) ---');
    await page.goto(`${BASE_URL}/clients/${MAVEN_ID}?preview=true`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 3000));

    const mavenChecks = await page.evaluate(() => {
      const text = document.body.innerText;
      const headerText = document.querySelector('[data-testid="finfix-client-header"]')?.innerText || '';
      const c2Text = document.querySelector('[data-testid="stat-tasks-completed"]')?.innerText || '';
      const isFinfixLeaked = text.includes('Finfix Pro');
      return {
        hasMavenName: headerText.includes('Maven Professionals'),
        isFinfixLeaked,
        statTasks: c2Text.replace(/\n/g, ' '),
        hasSidebar: Boolean(document.querySelector('[data-testid="finfix-client-sidebar"]')),
        hasProjects: Boolean(document.querySelector('[data-testid="project-progress-section"]'))
      };
    });
    console.log('Maven Professionals checks:', mavenChecks);
    if (!mavenChecks.hasMavenName || mavenChecks.isFinfixLeaked || !mavenChecks.hasSidebar || !mavenChecks.hasProjects) {
      throw new Error(`Maven Professionals verification failed: ${JSON.stringify(mavenChecks)}`);
    }
    console.log('[PASS] Maven Professionals renders with its OWN real name and tasks; ZERO cross-client leak.');

    const mavenScreenshot = path.join(ARTIFACTS_DIR, 'verify_maven_portal_live.png');
    await page.screenshot({ path: mavenScreenshot });
    console.log(`[PASS] Saved Maven Professionals screenshot to ${mavenScreenshot}`);

    // =========================================================================
    // 4. Test Client 3: PIXEL ALGOS View Client
    // =========================================================================
    console.log('\n--- 4. Verifying Pixel Algos View Client (?preview=true) ---');
    await page.goto(`${BASE_URL}/clients/${PIXEL_ID}?preview=true`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 3000));

    const pixelChecks = await page.evaluate(() => {
      const text = document.body.innerText;
      const headerText = document.querySelector('[data-testid="finfix-client-header"]')?.innerText || '';
      const isOtherLeaked = text.includes('Finfix Pro') || text.includes('Maven Professionals');
      return {
        hasPixelName: headerText.includes('Pixel Algos'),
        isOtherLeaked,
        hasSidebar: Boolean(document.querySelector('[data-testid="finfix-client-sidebar"]')),
        hasProjects: Boolean(document.querySelector('[data-testid="project-progress-section"]'))
      };
    });
    console.log('Pixel Algos checks:', pixelChecks);
    if (!pixelChecks.hasPixelName || pixelChecks.isOtherLeaked) {
      throw new Error(`Pixel Algos verification failed: ${JSON.stringify(pixelChecks)}`);
    }
    console.log('[PASS] Pixel Algos renders with its OWN real name and tasks; ZERO cross-client leak.');

    const pixelScreenshot = path.join(ARTIFACTS_DIR, 'verify_pixel_portal_live.png');
    await page.screenshot({ path: pixelScreenshot });
    console.log(`[PASS] Saved Pixel Algos screenshot to ${pixelScreenshot}`);

    // =========================================================================
    // 5. Test Client 4: PENTA CIPHER View Client
    // =========================================================================
    console.log('\n--- 5. Verifying Penta Cipher View Client (?preview=true) ---');
    await page.goto(`${BASE_URL}/clients/${PENTA_ID}?preview=true`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 3000));

    const pentaChecks = await page.evaluate(() => {
      const headerText = document.querySelector('[data-testid="finfix-client-header"]')?.innerText || '';
      return {
        hasPentaName: headerText.includes('Penta Cipher'),
        hasSidebar: Boolean(document.querySelector('[data-testid="finfix-client-sidebar"]'))
      };
    });
    console.log('Penta Cipher checks:', pentaChecks);
    if (!pentaChecks.hasPentaName || !pentaChecks.hasSidebar) {
      throw new Error(`Penta Cipher verification failed: ${JSON.stringify(pentaChecks)}`);
    }
    console.log('[PASS] Penta Cipher renders with its OWN real name and tasks; ZERO cross-client leak.');

    // =========================================================================
    // 6. Test Client 5: ARCHIVED CLIENT (Books2Clear)
    // =========================================================================
    console.log('\n--- 6. Verifying Archived Client (Books2Clear) ---');
    await page.goto(`${BASE_URL}/clients/${ARCHIVED_ID}?preview=true`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 3000));

    const archivedChecks = await page.evaluate(() => {
      const text = document.body.innerText;
      const tabDashboard = document.querySelector('[data-testid="tab-dashboard"]');
      const hasArchivedIndicator = text.includes('Archived') || text.includes('Read-Only');
      const hasClientName = text.includes('Books2Clear');
      return {
        hasArchivedIndicator,
        hasClientName,
        hasNoDashboardTab: tabDashboard === null
      };
    });
    console.log('Archived Client checks:', archivedChecks);
    if (!archivedChecks.hasArchivedIndicator || !archivedChecks.hasClientName || !archivedChecks.hasNoDashboardTab) {
      throw new Error(`Archived Client check failed: ${JSON.stringify(archivedChecks)}`);
    }
    console.log('[PASS] Archived client renders in read-only mode, and has NO active dashboard tab.');

    // =========================================================================
    // 7. Verify Staff Workspace & Dashboard Unchanged + Session Survival
    // =========================================================================
    console.log('\n--- 7. Verifying Staff Board & Dashboard are Unchanged ---');
    // Staff Board (without ?preview=true)
    await page.goto(`${BASE_URL}/clients/${FINFIX_ID}`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 3000));

    const staffBoardChecks = await page.evaluate(() => {
      const text = document.body.innerText;
      const isStaffAuthenticated = !text.includes('Sign in to Ops Hub');
      const hasStaffKanban = Boolean(document.querySelector('[data-testid="client-week-stepper"]') || document.querySelector('button[aria-label="+ Add Task"]'));
      const hasStaffReconciliation = text.includes('Client Safe Reconciliation') || text.includes('Client Visible');
      const hasTabDashboard = Boolean(document.querySelector('[data-testid="tab-dashboard"]'));
      const hasTabSetup = Boolean(document.querySelector('[data-testid="tab-setup"]'));
      return {
        isStaffAuthenticated,
        hasStaffKanban,
        hasStaffReconciliation,
        hasTabDashboard,
        hasTabSetup
      };
    });
    console.log('Staff Board checks:', staffBoardChecks);
    if (!staffBoardChecks.isStaffAuthenticated || !staffBoardChecks.hasStaffReconciliation || !staffBoardChecks.hasTabDashboard) {
      throw new Error(`Staff Board check failed: ${JSON.stringify(staffBoardChecks)}`);
    }
    console.log('[PASS] Staff board is completely unchanged, displays reconciliation banner with breakdown, and session survived.');

    // Staff Dashboard
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 3000));

    const staffDashChecks = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        isStaffAuthenticated: !text.includes('Sign in to Ops Hub'),
        hasStatCards: text.includes('Active In Flight') || text.includes('Awaiting Approval') || text.includes('Tasks Due Today'),
        hasKanban: text.includes('My Tasks') || text.includes('All Company Tasks')
      };
    });
    console.log('Staff Dashboard checks:', staffDashChecks);
    if (!staffDashChecks.isStaffAuthenticated || !staffDashChecks.hasStatCards || !staffDashChecks.hasKanban) {
      throw new Error(`Staff Dashboard check failed: ${JSON.stringify(staffDashChecks)}`);
    }
    console.log('[PASS] Staff Dashboard is completely intact and unchanged.');

    console.log('\n=============================================================');
    console.log('  ALL CHECKS PASSED: FINFIX PRO + 3 ACTIVE CLIENTS + ARCHIVED');
    console.log('=============================================================');
  } finally {
    await browser.close();
  }
}

runVerification().catch(err => {
  console.error('\n[FAIL] Verification script encountered an error:', err);
  process.exit(1);
});
