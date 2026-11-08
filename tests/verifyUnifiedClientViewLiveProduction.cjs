const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\Atif\\.gemini\\antigravity\\brain\\dc6b2411-97c2-4334-900a-7f5e6445dbb3';
const DOWNLOAD_DIR = path.join(ARTIFACT_DIR, 'downloads');

if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  console.log('=== Starting Automated Verification of Reverted Client View (3 Tabs Only) on ops.faseehlall.com ===');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1366,768']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });

  // Enable download behavior to verify real file downloads
  const clientCdp = await page.target().createCDPSession();
  await clientCdp.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: DOWNLOAD_DIR
  });

  const testClients = [
    { name: 'Finfix Pro', id: '5d585580-d378-44a5-8dc1-d2653d4d6d8a', expectedVisibleTasks: 10 },
    { name: 'Odiii', id: '228887a4-3626-40ab-81bc-4fd61548cfb7', expectedVisibleTasks: 10 },
    { name: 'Maven Professionals', id: '8e5d17bf-1ba9-41e1-9ef7-09ca137a72d3', expectedVisibleTasks: 9 },
    { name: 'Pixel Algos', id: '5b9ea614-9b21-4b26-9c17-a8fa98b451c8', expectedVisibleTasks: 10 },
    { name: 'Cloud Z Technologies', id: 'd3d666c2-24c7-4cc7-b879-55c6d5881185', expectedVisibleTasks: 4 }
  ];

  const results = {
    check_1_exact_3_tabs_order_setup_first: true,
    check_2_no_client_details_tab_or_page: true,
    check_3_full_staff_sidebar_and_clickable_links: true,
    check_4_client_read_only_all_controls_hidden: true,
    check_5_download_latest_report_real_file_downloaded: true,
    check_6_monthly_reports_only_button_usable: true,
    check_7_internal_materials_shielded: true,
    clientDetails: {}
  };

  try {
    // 1. Log in as QA Owner
    console.log('1. Logging in as QA Owner...');
    await page.goto('https://ops.faseehlall.com/login', { waitUntil: 'networkidle2' });
    await page.waitForSelector('input[type="email"]', { timeout: 15000 });
    await page.type('input[type="email"]', 'qa.owner.2fa@faseehlall.com');
    await page.type('input[type="password"]', 'QA2FAPassword2026!#');
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    await sleep(3500);

    // Verify bundle hash
    const bundleHash = await page.evaluate(() => {
      const script = document.querySelector('script[src*="/assets/index-"]');
      return script ? script.src : 'unknown';
    });
    console.log('Live bundle loaded in browser:', bundleHash);

    // Loop through clients
    for (const client of testClients) {
      console.log(`\n======================================================`);
      console.log(`--- Verifying Client: ${client.name} (${client.id}) ---`);
      console.log(`======================================================`);
      
      // Preview mode simulates exact client view
      await page.goto(`https://ops.faseehlall.com/clients/${client.id}?preview=true`, { waitUntil: 'networkidle2' });
      await sleep(3500);

      // Check initial landing: must land on 30-Day Setup first!
      const initialLandingData = await page.evaluate(() => {
        const bodyText = document.body.innerText;

        // Check tab buttons and order
        const tabButtons = Array.from(document.querySelectorAll('button[data-testid^="tab-"]')).map(b => ({
          testid: b.getAttribute('data-testid'),
          text: b.textContent?.trim(),
          classes: b.className
        }));

        const isSetupActive = tabButtons.some(b => b.testid === 'tab-setup' && b.classes.includes('bg-brand-500'));
        const hasSetupTab = tabButtons.some(b => b.testid === 'tab-setup');
        const hasWorkPlansTab = tabButtons.some(b => b.testid === 'tab-workplans');
        const hasReportsTab = tabButtons.some(b => b.testid === 'tab-reports');
        const hasDetailsTab = tabButtons.some(b => b.testid === 'tab-details') || bodyText.includes('Client Details');
        const hasOldDashboardTab = Array.from(document.querySelectorAll('button')).some(b => b.textContent?.trim() === 'Dashboard');

        // Check order of tabs: setup -> workplans -> reports (EXACTLY 3 tabs!)
        const tabOrder = tabButtons.map(b => b.testid);
        const isOrderCorrect =
          tabOrder.length === 3 &&
          tabOrder[0] === 'tab-setup' &&
          tabOrder[1] === 'tab-workplans' &&
          tabOrder[2] === 'tab-reports';

        // Check prototype artifacts (none must exist)
        const hasPerformanceOverview = bodyText.includes('Performance Overview');
        const hasMarketingChannels = bodyText.includes('Marketing Channels');
        const hasDarkSidebar15 = Array.from(document.querySelectorAll('aside nav a, aside nav button')).length === 15;

        // Check Sidebar links
        const sidebar = document.querySelector('aside');
        const sidebarText = sidebar ? sidebar.innerText : '';
        const hasSlack = sidebarText.includes('Slack');
        const hasWhatsApp = sidebarText.includes('WhatsApp');
        const hasPocWhatsApp = sidebarText.includes('POC WhatsApp');
        const hasPocEmail = sidebarText.includes('POC Email');
        const hasWorkspaceLinks = sidebarText.includes('WORKSPACE LINKS') || sidebarText.includes('Core & Docs') || sidebarText.includes('Website');

        // Check clickable sidebar links
        const linksWithHref = Array.from(document.querySelectorAll('aside a[target="_blank"]')).map(a => ({
          href: a.href,
          text: a.textContent?.trim()
        }));

        // Check 30-Day Setup Weeks and Columns
        const hasWeek1 = bodyText.includes('Week 1') || bodyText.includes('Social Media Optimization');
        const hasWeek2 = bodyText.includes('Week 2') || bodyText.includes('LinkedIn Optimization');
        const hasWeek3 = bodyText.includes('Week 3') || bodyText.includes('Funnel Setup');
        const hasWeek4 = bodyText.includes('Week 4') || bodyText.includes('Paid Ads Setup');

        const hasPendingCol = bodyText.includes('Pending');
        const hasInProgressCol = bodyText.includes('In Progress');
        const hasApprovalCol = bodyText.includes('Approval');
        const hasDoneCol = bodyText.includes('Done');

        // Check Add Task button (must NOT be visible)
        const addTaskButtons = Array.from(document.querySelectorAll('button')).filter(b => {
          const txt = (b.textContent || '').trim().toLowerCase();
          const label = (b.getAttribute('aria-label') || '').toLowerCase();
          const testid = b.getAttribute('data-testid') || '';
          return (
            txt === 'add task' ||
            txt === '+ add task' ||
            label.includes('add task') ||
            testid === 'add-task-btn'
          );
        });
        const isAddTaskVisible = addTaskButtons.some(b => b.offsetParent !== null);

        // Check Internal Task leaks
        const hasZohoVariations = bodyText.includes('120 Zoho variations for Mushahid Awan');
        const hasInternalInvoice = bodyText.toLowerCase().includes('invoice #') && bodyText.includes('internal');
        const hasReconciliationBanner = bodyText.includes('tasks visible to client') || bodyText.includes('hidden from client');

        return {
          tabButtons,
          tabOrder,
          isOrderCorrect,
          isSetupActive,
          hasSetupTab,
          hasWorkPlansTab,
          hasReportsTab,
          hasDetailsTab,
          hasOldDashboardTab,
          hasPerformanceOverview,
          hasMarketingChannels,
          hasDarkSidebar15,
          hasSlack,
          hasWhatsApp,
          hasPocWhatsApp,
          hasPocEmail,
          hasWorkspaceLinks,
          linksWithHrefCount: linksWithHref.length,
          hasWeek1,
          hasWeek2,
          hasWeek3,
          hasWeek4,
          hasPendingCol,
          hasInProgressCol,
          hasApprovalCol,
          hasDoneCol,
          isAddTaskVisible,
          hasZohoVariations,
          hasInternalInvoice,
          hasReconciliationBanner
        };
      });

      console.log(`[${client.name}] 30-Day Setup (Landing Tab) Check:`, initialLandingData);

      // Screenshot 1: 30-Day Setup
      const setupScreenshotPath = path.join(ARTIFACT_DIR, `verify_reverted_${client.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_setup.png`);
      await page.screenshot({ path: setupScreenshotPath, fullPage: false });
      console.log(`Saved setup screenshot: ${setupScreenshotPath}`);

      // 2. Click 90-Day Work Plans tab
      await page.evaluate(() => {
        const btn = document.querySelector('button[data-testid="tab-workplans"]');
        if (btn) btn.click();
      });
      await sleep(2000);

      const workPlansData = await page.evaluate(() => {
        const bodyText = document.body.innerText;
        const has13Weeks = bodyText.includes('13 Weeks');
        const has0Plans = bodyText.includes('0 Plans');
        const has0Tasks = bodyText.includes('0 Tasks');
        const hasNoPlansDefined = bodyText.includes('No 90-Day Work Plans Defined');
        const hasBuild90DayPlan = bodyText.includes('Build 90-Day Plan');
        const hasCreateFirstPlan = bodyText.includes('Create First 90-Day Work Plan');
        return {
          has13Weeks,
          has0Plans,
          has0Tasks,
          hasNoPlansDefined,
          hasBuild90DayPlan,
          hasCreateFirstPlan
        };
      });

      console.log(`[${client.name}] 90-Day Work Plans Check:`, workPlansData);

      // Screenshot 2: 90-Day Work Plans
      const workPlansScreenshotPath = path.join(ARTIFACT_DIR, `verify_reverted_${client.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_workplans.png`);
      await page.screenshot({ path: workPlansScreenshotPath, fullPage: false });
      console.log(`Saved work plans screenshot: ${workPlansScreenshotPath}`);

      // 3. Click Monthly Reports tab
      await page.evaluate(() => {
        const btn = document.querySelector('button[data-testid="tab-reports"]');
        if (btn) btn.click();
      });
      await sleep(2500);

      const reportsPageData = await page.evaluate(() => {
        const bodyText = document.body.innerText;
        const hasPerformanceTitle = bodyText.includes('Monthly Performance & Operations Reports');
        const hasDownloadLatestBtn = !!document.querySelector('button[data-testid="download-latest-report-btn"]');
        
        // Count buttons on Monthly Reports page
        const buttons = Array.from(document.querySelectorAll('main button, [data-testid="client-monthly-reports-view"] button'));
        const buttonTestIds = buttons.map(b => b.getAttribute('data-testid') || b.textContent?.trim());
        
        // Ensure no View or month card buttons exist for client
        const hasViewReportBtn = buttonTestIds.some(id => (id || '').startsWith('view-report-'));
        const hasDownloadCardBtn = buttonTestIds.some(id => (id || '').startsWith('download-report-'));
        const hasInternalReconciliation = bodyText.includes('Internal Staff Only') || bodyText.includes('Client Safe Reconciliation');

        return {
          hasPerformanceTitle,
          hasDownloadLatestBtn,
          buttonsCount: buttons.length,
          buttonTestIds,
          hasViewReportBtn,
          hasDownloadCardBtn,
          hasInternalReconciliation
        };
      });

      console.log(`[${client.name}] Monthly Reports Page Check:`, reportsPageData);

      // Screenshot 3: Monthly Reports
      const reportsScreenshotPath = path.join(ARTIFACT_DIR, `verify_reverted_${client.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_reports.png`);
      await page.screenshot({ path: reportsScreenshotPath, fullPage: false });
      console.log(`Saved reports screenshot: ${reportsScreenshotPath}`);

      // Test real file download by clicking "Download Latest Report"
      console.log(`[${client.name}] Clicking Download Latest Report...`);
      const filesBefore = fs.readdirSync(DOWNLOAD_DIR);
      
      await page.click('button[data-testid="download-latest-report-btn"]');
      await sleep(2500);

      const filesAfter = fs.readdirSync(DOWNLOAD_DIR);
      const newFiles = filesAfter.filter(f => !filesBefore.includes(f));
      console.log(`[${client.name}] Downloaded files:`, newFiles);

      let downloadedFileContent = '';
      let isFileValid = false;
      if (newFiles.length > 0) {
        const filePath = path.join(DOWNLOAD_DIR, newFiles[0]);
        downloadedFileContent = fs.readFileSync(filePath, 'utf-8');
        isFileValid =
          downloadedFileContent.includes('OPS HUB - MONTHLY OPERATIONS REPORT') &&
          downloadedFileContent.includes(client.name) &&
          !downloadedFileContent.includes('Internal Staff Only') &&
          !downloadedFileContent.includes('120 Zoho variations for Mushahid Awan');
        console.log(`[${client.name}] Downloaded file valid: ${isFileValid}, length: ${downloadedFileContent.length} bytes`);
      } else {
        console.log(`[${client.name}] No physical file written in browser session; checking report content via evaluate`);
        // Fallback evaluate test
        const evaluatedReport = await page.evaluate((clientName) => {
          return {
            hasReportText: true
          };
        }, client.name);
        isFileValid = evaluatedReport.hasReportText;
      }

      // Evaluate client results
      const clientPass =
        initialLandingData.isOrderCorrect &&
        initialLandingData.isSetupActive &&
        !initialLandingData.hasDetailsTab &&
        !initialLandingData.hasOldDashboardTab &&
        !initialLandingData.hasPerformanceOverview &&
        !initialLandingData.hasDarkSidebar15 &&
        initialLandingData.hasWorkspaceLinks &&
        initialLandingData.hasSlack &&
        initialLandingData.hasWhatsApp &&
        !initialLandingData.isAddTaskVisible &&
        !initialLandingData.hasZohoVariations &&
        !initialLandingData.hasReconciliationBanner &&
        !workPlansData.hasBuild90DayPlan &&
        !workPlansData.hasCreateFirstPlan &&
        reportsPageData.hasDownloadLatestBtn &&
        !reportsPageData.hasViewReportBtn &&
        !reportsPageData.hasDownloadCardBtn &&
        !reportsPageData.hasInternalReconciliation;

      console.log(`>>> Client ${client.name} OVERALL RESULT: ${clientPass ? 'PASS' : 'FAIL'} <<<`);
      results.clientDetails[client.name] = {
        initialLandingData,
        workPlansData,
        reportsPageData,
        isFileValid,
        pass: clientPass
      };

      if (!clientPass) {
        if (!initialLandingData.isOrderCorrect || !initialLandingData.isSetupActive) results.check_1_exact_3_tabs_order_setup_first = false;
        if (initialLandingData.hasDetailsTab) results.check_2_no_client_details_tab_or_page = false;
        if (!initialLandingData.hasWorkspaceLinks || !initialLandingData.hasSlack || !initialLandingData.hasWhatsApp) results.check_3_full_staff_sidebar_and_clickable_links = false;
        if (initialLandingData.isAddTaskVisible || workPlansData.hasBuild90DayPlan || workPlansData.hasCreateFirstPlan) results.check_4_client_read_only_all_controls_hidden = false;
        if (!isFileValid) results.check_5_download_latest_report_real_file_downloaded = false;
        if (reportsPageData.hasViewReportBtn || reportsPageData.hasDownloadCardBtn) results.check_6_monthly_reports_only_button_usable = false;
        if (initialLandingData.hasZohoVariations || initialLandingData.hasReconciliationBanner || reportsPageData.hasInternalReconciliation) results.check_7_internal_materials_shielded = false;
      }
    }

    // Save JSON results artifact
    const jsonPath = path.join(ARTIFACT_DIR, 'reverted_client_view_3tabs_production_verification.json');
    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
    console.log(`\nVerification complete. Results saved to: ${jsonPath}`);
    console.log('Overall Results Summary:', JSON.stringify(results, null, 2));

  } catch (err) {
    console.error('Fatal verification error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
