const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\Atif\\.gemini\\antigravity\\brain\\dc6b2411-97c2-4334-900a-7f5e6445dbb3';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  console.log('=== Starting Live Production Automated Verification of ALL 4 Problems on ops.faseehlall.com ===');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1366,768']
  });

  const page = await browser.newPage();
  // Set laptop resolution 1366x768
  await page.setViewport({ width: 1366, height: 768 });

  const results = {
    problem1_no_zero_first_paint: false,
    problem2_maven_funnel_setup_in_review: false,
    problem3_footer_reconciliation_exact_totals: false,
    problem4_staff_sidebar_1366x768_laptop_usable: false,
    details: {}
  };

  try {
    // 1. Login as QA Owner
    console.log('1. Logging in as QA Owner...');
    await page.goto('https://ops.faseehlall.com/login', { waitUntil: 'networkidle2' });
    await page.waitForSelector('input[type="email"]', { timeout: 15000 });
    await page.type('input[type="email"]', 'qa.owner.2fa@faseehlall.com');
    await page.type('input[type="password"]', 'QA2FAPassword2026!#');
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    await sleep(2500);

    // =========================================================================
    // VERIFICATION 1: Problem 1 — No 0/0 on first paint on Cloud Z, Pixel, Maven, Finfix
    // =========================================================================
    console.log('2. Testing Problem 1: First paint on staff boards must NOT be 0/0...');
    const testClients = [
      { name: 'Cloud Z Technologies', id: 'd3d666c2-24c7-4cc7-b879-55c6d5881185', expectedWeekTotal: '3/6' },
      { name: 'Maven Professionals', id: '8e5d17bf-1ba9-41e1-9ef7-09ca137a72d3', expectedWeekTotal: '0/10' },
      { name: 'Finfix Pro', id: '5d585580-d378-44a5-8dc1-d2653d4d6d8a', expectedWeekTotal: '1/1' },
      { name: 'Pixel Algos', id: '5b9ea614-9b21-4b26-9c17-a8fa98b451c8', expectedWeekTotal: '0/2' }
    ];

    let problem1AllPass = true;

    for (const c of testClients) {
      console.log(`Checking staff board navigation for ${c.name}...`);
      await page.goto(`https://ops.faseehlall.com/clients/${c.id}`, { waitUntil: 'domcontentloaded' });

      // Immediate check before delay
      const firstPaintCheck = await page.evaluate(() => {
        const text = document.body.innerText;
        const hasPulse = Boolean(document.querySelector('.animate-pulse'));
        const hasZeroZero = text.includes('0/0') || text.includes('0 tasks (0%)');
        return { hasPulse, hasZeroZero };
      });

      console.log(`${c.name} immediate paint:`, firstPaintCheck);
      if (firstPaintCheck.hasZeroZero && !firstPaintCheck.hasPulse) {
        console.error(`FAILED: ${c.name} showed 0/0 on first paint!`);
        problem1AllPass = false;
      }

      // Wait for tasks to load
      await sleep(3500);
      const loadedCheck = await page.evaluate(() => {
        return {
          bodyText: document.body.innerText,
          hasPulse: Boolean(document.querySelector('.animate-pulse'))
        };
      });

      const loadedMatch = loadedCheck.bodyText.includes(c.expectedWeekTotal);
      console.log(`${c.name} loaded state contains ${c.expectedWeekTotal}:`, loadedMatch);
      if (!loadedMatch) {
        problem1AllPass = false;
      }
    }

    results.problem1_no_zero_first_paint = problem1AllPass;

    // =========================================================================
    // VERIFICATION 2: Problem 2 — Maven Funnel Setup evaluates to In Review
    // =========================================================================
    console.log('3. Testing Problem 2: Maven Funnel Setup evaluates to In Review...');
    await page.goto('https://ops.faseehlall.com/clients/8e5d17bf-1ba9-41e1-9ef7-09ca137a72d3?preview=true', { waitUntil: 'networkidle2' });
    await sleep(3500);

    const mavenPortalProgress = await page.evaluate(() => {
      const section = document.querySelector('[data-testid="project-progress-section"]');
      const text = section ? section.innerText : '';
      const hasPurple = section ? Boolean(section.querySelector('.bg-purple-600')) : false;
      return { text, hasPurple };
    });

    console.log('Maven Portal Progress Section:', mavenPortalProgress);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verify_live_maven_funnel_in_review.png') });

    const mavenFunnelInReview = mavenPortalProgress.text.includes('Funnel Setup') &&
      mavenPortalProgress.text.includes('In Review') &&
      mavenPortalProgress.hasPurple &&
      !mavenPortalProgress.text.includes('Funnel Setup\nIn Progress');

    results.problem2_maven_funnel_setup_in_review = mavenFunnelInReview;

    // =========================================================================
    // VERIFICATION 3: Problem 3 — Dashboard footer reads exact totals + reconciliation
    // =========================================================================
    console.log('4. Testing Problem 3: Cloud Z and Maven dashboard footers...');
    // Cloud Z
    await page.goto('https://ops.faseehlall.com/clients/d3d666c2-24c7-4cc7-b879-55c6d5881185?preview=true', { waitUntil: 'networkidle2' });
    await sleep(3500);

    const cloudZFooter = await page.evaluate(() => {
      const bottomBar = document.querySelector('[data-testid="client-portal-bottom-bar"]');
      return bottomBar ? bottomBar.innerText : '';
    });
    console.log('Cloud Z Footer:', cloudZFooter);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verify_live_cloud_z_footer.png') });

    // Maven
    await page.goto('https://ops.faseehlall.com/clients/8e5d17bf-1ba9-41e1-9ef7-09ca137a72d3?preview=true', { waitUntil: 'networkidle2' });
    await sleep(3500);
    const mavenFooter = await page.evaluate(() => {
      const bottomBar = document.querySelector('[data-testid="client-portal-bottom-bar"]');
      return bottomBar ? bottomBar.innerText : '';
    });
    console.log('Maven Footer:', mavenFooter);

    // Finfix
    await page.goto('https://ops.faseehlall.com/clients/5d585580-d378-44a5-8dc1-d2653d4d6d8a?preview=true', { waitUntil: 'networkidle2' });
    await sleep(3500);
    const finfixFooter = await page.evaluate(() => {
      const bottomBar = document.querySelector('[data-testid="client-portal-bottom-bar"]');
      return bottomBar ? bottomBar.innerText : '';
    });
    console.log('Finfix Footer:', finfixFooter);

    const cloudZFooterPass = cloudZFooter.includes('50% completed · 3 of 6 deliverables completed (4 visible + 2 internal)');
    const mavenFooterPass = mavenFooter.includes('0% completed · 0 of 10 deliverables completed (9 visible + 1 internal)');
    const finfixFooterPass = finfixFooter.includes('10% completed · 1 of 10 deliverables completed');

    results.problem3_footer_reconciliation_exact_totals = cloudZFooterPass && mavenFooterPass && finfixFooterPass;

    // =========================================================================
    // VERIFICATION 4: Problem 4 — Staff Sidebar on 1366x768 Laptop
    // =========================================================================
    console.log('5. Testing Problem 4: Staff Sidebar on 1366x768 Laptop...');
    await page.goto('https://ops.faseehlall.com/clients/d3d666c2-24c7-4cc7-b879-55c6d5881185', { waitUntil: 'networkidle2' });
    await sleep(3500);

    const staffSidebarCheck = await page.evaluate(() => {
      const aside = document.querySelector('aside');
      if (!aside) return null;

      // Jump pills
      const jumpButtons = Array.from(aside.querySelectorAll('button')).map(b => b.innerText.trim());
      const hasCoreJump = jumpButtons.some(b => b === 'Core');
      const hasContactJump = jumpButtons.some(b => b === 'Communication');

      // Category headers
      const catCore = document.querySelector('[data-testid="workspace-cat-core"]');
      const catContact = document.querySelector('[data-testid="workspace-cat-contact"]');

      // Total links count
      const allLinks = Array.from(document.querySelectorAll('[data-testid*="sidebar-link-"]'));

      // Communication Links
      const slackLink = document.querySelector('[data-testid*="sidebar-link-slack-channel"]');
      const whatsappLink = document.querySelector('[data-testid*="sidebar-link-whatsapp-group"]');
      const pocNumLink = document.querySelector('[data-testid*="sidebar-link-poc-number"]');
      const pocEmailLink = document.querySelector('[data-testid*="sidebar-link-poc-email"]');

      // Settings button
      const settingsBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Settings'));

      return {
        totalLinksCount: allLinks.length,
        hasCoreJump,
        hasContactJump,
        hasCatCore: Boolean(catCore),
        hasCatContact: Boolean(catContact),
        hasSlack: Boolean(slackLink),
        hasWhatsapp: Boolean(whatsappLink),
        hasPocNum: Boolean(pocNumLink),
        hasPocEmail: Boolean(pocEmailLink),
        hasSettings: Boolean(settingsBtn)
      };
    });

    console.log('Staff Sidebar Laptop Inspection:', staffSidebarCheck);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verify_live_staff_sidebar_1366x768.png') });

    // Test clicking the Contact quick-jump pill
    console.log('Testing click on Contact quick-jump pill...');
    const contactPill = await page.evaluateHandle(() => {
      return Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Communication');
    });

    if (contactPill) {
      await contactPill.click();
      await sleep(1000);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verify_live_staff_sidebar_scrolled_contact.png') });
    }

    const problem4Pass = Boolean(
      staffSidebarCheck &&
      staffSidebarCheck.totalLinksCount === 29 &&
      staffSidebarCheck.hasCoreJump &&
      staffSidebarCheck.hasContactJump &&
      staffSidebarCheck.hasCatCore &&
      staffSidebarCheck.hasCatContact &&
      staffSidebarCheck.hasSlack &&
      staffSidebarCheck.hasWhatsapp &&
      staffSidebarCheck.hasPocNum &&
      staffSidebarCheck.hasPocEmail &&
      staffSidebarCheck.hasSettings
    );

    results.problem4_staff_sidebar_1366x768_laptop_usable = problem4Pass;

    results.details = {
      problem1AllPass,
      mavenFunnelInReview,
      cloudZFooter,
      mavenFooter,
      finfixFooter,
      staffSidebarCheck
    };

    console.log('====================================================');
    console.log('=== Final Verification Results for All 4 Problems ===');
    console.log('====================================================');
    console.log(JSON.stringify(results, null, 2));

    fs.writeFileSync(
      path.join(ARTIFACT_DIR, 'four_mistakes_production_verification.json'),
      JSON.stringify(results, null, 2)
    );

  } catch (err) {
    console.error('Verification error:', err);
  } finally {
    await browser.close();
  }
})();
