const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\Atif\\.gemini\\antigravity\\brain\\dc6b2411-97c2-4334-900a-7f5e6445dbb3';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  console.log('=== Starting Live Production Automated Verification of Personal Branding on ops.faseehlall.com ===');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1366,768']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });

  const testClients = [
    { name: 'Finfix Pro', id: '5d585580-d378-44a5-8dc1-d2653d4d6d8a', expectedPercent: '10%', expectedDeliverables: '1 of 10' },
    { name: 'Odiii', id: '228887a4-3626-40ab-81bc-4fd61548cfb7', expectedPercent: '0%', expectedDeliverables: '0 of 0' },
    { name: 'Maven Professionals', id: '8e5d17bf-1ba9-41e1-9ef7-09ca137a72d3', expectedPercent: '0%', expectedDeliverables: '0 of 10' },
    { name: 'Pixel Algos', id: '5b9ea614-9b21-4b26-9c17-a8fa98b451c8', expectedPercent: '0%', expectedDeliverables: '0 of 3' },
    { name: 'Cloud Z Technologies', id: 'd3d666c2-24c7-4cc7-b879-55c6d5881185', expectedPercent: '50%', expectedDeliverables: '3 of 6' }
  ];

  const results = {
    branding_check_1_red_brand_elements: true,
    branding_check_2_no_teal_or_generic_lightning: true,
    branding_check_3_client_logo_and_avatar: true,
    branding_check_4_status_colors_and_metrics_intact: true,
    branding_check_5_staff_view_intact: true,
    clientDetails: {}
  };

  try {
    // 1. Log in
    console.log('1. Logging in as QA Owner...');
    await page.goto('https://ops.faseehlall.com/login', { waitUntil: 'networkidle2' });
    await page.waitForSelector('input[type="email"]', { timeout: 15000 });
    await page.type('input[type="email"]', 'qa.owner.2fa@faseehlall.com');
    await page.type('input[type="password"]', 'QA2FAPassword2026!#');
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    await sleep(2500);

    // 2. Check each of the 5 active clients in client preview mode
    for (const c of testClients) {
      console.log(`\nChecking client preview for ${c.name}...`);
      await page.goto(`https://ops.faseehlall.com/clients/${c.id}?preview=true`, { waitUntil: 'networkidle2' });
      await sleep(3500);

      const inspection = await page.evaluate(() => {
        const brandLogo = document.querySelector('[data-testid="faseeh-lall-brand-logo"]');
        const secondaryLogo = document.querySelector('[data-testid="client-secondary-logo"]');
        const initialsAvatar = document.querySelector('[data-testid="client-initials-avatar"]');
        const headerLogo = document.querySelector('[data-testid="header-client-logo"]');
        const headerAvatar = document.querySelector('[data-testid="header-client-avatar"]');
        const navDashboard = document.querySelector('[data-testid="nav-dashboard"]');
        const zapIcon = document.querySelector('.lucide-zap');
        const projectSection = document.querySelector('[data-testid="project-progress-section"]');
        const bottomBar = document.querySelector('[data-testid="client-portal-bottom-bar"]');
        const sidebar = document.querySelector('[data-testid="finfix-client-sidebar"]');
        const completionCard = document.querySelector('[data-testid="stat-project-completion"]');
        const tasksCard = document.querySelector('[data-testid="stat-tasks-completed"]');

        // Check if any element contains the old teal background #0D9488
        const bodyHtml = document.body.innerHTML;
        const hasOldTealHex = bodyHtml.includes('#0D9488') || bodyHtml.includes('rgb(13, 148, 136)');
        const hasZap = Boolean(zapIcon);

        // Active nav item styling
        const navDashboardClasses = navDashboard ? navDashboard.className : '';
        const hasRedActiveNav = navDashboardClasses.includes('bg-brand-500') || navDashboardClasses.includes('bg-[#e62e43]');

        // Buttons styling
        const buttons = Array.from(document.querySelectorAll('button'));
        const downloadReportBtn = buttons.find(b => b.innerText.includes('Download Monthly Report'));
        const downloadReportClasses = downloadReportBtn ? downloadReportBtn.className : '';
        const hasRedReportBtn = downloadReportClasses.includes('bg-brand-500');

        const viewAllBtns = buttons.filter(b => b.innerText.includes('View All'));
        const allViewAllRed = viewAllBtns.every(b => b.className.includes('text-brand-600'));

        return {
          hasBrandLogo: Boolean(brandLogo),
          brandLogoSrc: brandLogo ? brandLogo.getAttribute('src') : null,
          hasSecondaryLogo: Boolean(secondaryLogo),
          hasInitialsAvatar: Boolean(initialsAvatar),
          hasHeaderLogo: Boolean(headerLogo),
          hasHeaderAvatar: Boolean(headerAvatar),
          hasZap,
          hasOldTealHex,
          hasRedActiveNav,
          hasRedReportBtn,
          allViewAllRed,
          completionText: completionCard ? completionCard.innerText : '',
          tasksText: tasksCard ? tasksCard.innerText : '',
          bottomBarText: bottomBar ? bottomBar.innerText : '',
          projectSectionHtml: projectSection ? projectSection.innerHTML : '',
          sidebarText: sidebar ? sidebar.innerText : ''
        };
      });

      console.log(`${c.name} Inspection:`, {
        hasBrandLogo: inspection.hasBrandLogo,
        brandLogoSrc: inspection.brandLogoSrc,
        hasSecondaryLogo: inspection.hasSecondaryLogo,
        hasInitialsAvatar: inspection.hasInitialsAvatar,
        hasHeaderLogo: inspection.hasHeaderLogo,
        hasHeaderAvatar: inspection.hasHeaderAvatar,
        hasZap: inspection.hasZap,
        hasOldTealHex: inspection.hasOldTealHex,
        hasRedActiveNav: inspection.hasRedActiveNav,
        hasRedReportBtn: inspection.hasRedReportBtn,
        allViewAllRed: inspection.allViewAllRed
      });

      // Screenshots for documentation
      const screenshotFilename = `verify_live_branding_${c.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.png`;
      await page.screenshot({ path: path.join(ARTIFACT_DIR, screenshotFilename) });

      // Assertions
      if (!inspection.hasBrandLogo || inspection.brandLogoSrc !== '/logo.png') {
        console.error(`FAILED: ${c.name} missing red brand logo!`);
        results.branding_check_1_red_brand_elements = false;
      }
      if (inspection.hasZap || inspection.hasOldTealHex) {
        console.error(`FAILED: ${c.name} has generic lightning or old teal hex!`);
        results.branding_check_2_no_teal_or_generic_lightning = false;
      }
      if (!inspection.hasRedActiveNav || !inspection.hasRedReportBtn || !inspection.allViewAllRed) {
        console.error(`FAILED: ${c.name} red elements missing!`);
        results.branding_check_1_red_brand_elements = false;
      }
      if (!inspection.hasSecondaryLogo && !inspection.hasInitialsAvatar) {
        console.error(`FAILED: ${c.name} missing both secondary logo and initials avatar!`);
        results.branding_check_3_client_logo_and_avatar = false;
      }

      // Check numbers
      const completionMatches = inspection.completionText.includes(c.expectedPercent);
      console.log(`${c.name} completion matches ${c.expectedPercent}:`, completionMatches);
      if (!completionMatches) {
        results.branding_check_4_status_colors_and_metrics_intact = false;
      }

      results.clientDetails[c.name] = {
        inspection,
        screenshotFilename
      };
    }

    // 3. Verify staff view is unchanged (red personal branding, no client leak)
    console.log('\nChecking Staff View for Cloud Z Technologies...');
    await page.goto('https://ops.faseehlall.com/clients/d3d666c2-24c7-4cc7-b879-55c6d5881185', { waitUntil: 'networkidle2' });
    await sleep(3500);

    const staffInspection = await page.evaluate(() => {
      const brandLogo = document.querySelector('img[alt="FASEEH LALL & CO."]');
      const clientWorkspaceHeader = document.querySelector('header');
      const aside = document.querySelector('aside');
      return {
        hasStaffBrandLogo: Boolean(brandLogo),
        asideHasCategories: aside ? aside.innerText.toUpperCase().includes('WORKSPACE LINKS') : false,
        headerHasOwnerDashboard: document.body.innerText.includes('Good morning, Faseeh Lall')
      };
    });

    console.log('Staff View Inspection:', staffInspection);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verify_live_branding_staff_view.png') });

    if (!staffInspection.hasStaffBrandLogo || !staffInspection.asideHasCategories) {
      results.branding_check_5_staff_view_intact = false;
    }

    console.log('\n======================================================');
    console.log('=== Final Verification Results for Personal Branding ===');
    console.log('======================================================');
    console.log(JSON.stringify(results, null, 2));

    fs.writeFileSync(
      path.join(ARTIFACT_DIR, 'branding_production_verification.json'),
      JSON.stringify(results, null, 2)
    );

  } catch (err) {
    console.error('Verification error:', err);
  } finally {
    await browser.close();
  }
})();
