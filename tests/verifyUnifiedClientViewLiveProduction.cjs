const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\Atif\\.gemini\\antigravity\\brain\\dc6b2411-97c2-4334-900a-7f5e6445dbb3';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  console.log('=== Starting Automated Verification of Reverted Client View on ops.faseehlall.com ===');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1366,768']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });

  const testClients = [
    { name: 'Finfix Pro', id: '5d585580-d378-44a5-8dc1-d2653d4d6d8a' },
    { name: 'Odiii', id: '228887a4-3626-40ab-81bc-4fd61548cfb7' },
    { name: 'Maven Professionals', id: '8e5d17bf-1ba9-41e1-9ef7-09ca137a72d3' },
    { name: 'Pixel Algos', id: '5b9ea614-9b21-4b26-9c17-a8fa98b451c8' },
    { name: 'Cloud Z Technologies', id: 'd3d666c2-24c7-4cc7-b879-55c6d5881185' }
  ];

  const results = {
    check_1_tab_order_and_initial_client_details: true,
    check_2_no_separate_dashboard_or_telemetry: true,
    check_3_full_staff_sidebar_rendered: true,
    check_4_client_details_tab_read_only: true,
    check_5_setup_tab_read_only_and_columns: true,
    check_6_workplans_tab_read_only: true,
    check_7_internal_materials_shielded: true,
    check_8_monthly_reports_hidden_for_client: true,
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
      
      // Preview mode simulates client view
      await page.goto(`https://ops.faseehlall.com/clients/${client.id}?preview=true`, { waitUntil: 'networkidle2' });
      await sleep(3500);

      // Check initial landing: must land on Client Details first!
      const initialLandingData = await page.evaluate(() => {
        const bodyText = document.body.innerText;

        // Check tab buttons and order
        const tabButtons = Array.from(document.querySelectorAll('button[data-testid^="tab-"]')).map(b => ({
          testid: b.getAttribute('data-testid'),
          text: b.textContent?.trim(),
          classes: b.className
        }));

        const isDetailsActive = tabButtons.some(b => b.testid === 'tab-details' && b.classes.includes('bg-brand-500'));
        const hasSetupTab = tabButtons.some(b => b.testid === 'tab-setup');
        const hasWorkPlansTab = tabButtons.some(b => b.testid === 'tab-workplans');
        const hasReportsTab = tabButtons.some(b => b.testid === 'tab-reports') || bodyText.includes('Monthly Reports');
        const hasOldDashboardTab = Array.from(document.querySelectorAll('button')).some(b => b.textContent?.trim() === 'Dashboard');

        // Check order of tabs: details -> setup -> workplans
        const tabOrder = tabButtons.map(b => b.testid);
        const isOrderCorrect =
          tabOrder.indexOf('tab-details') !== -1 &&
          tabOrder.indexOf('tab-setup') !== -1 &&
          tabOrder.indexOf('tab-workplans') !== -1 &&
          tabOrder.indexOf('tab-details') < tabOrder.indexOf('tab-setup') &&
          tabOrder.indexOf('tab-setup') < tabOrder.indexOf('tab-workplans');

        // Check prototype artifacts (none must exist)
        const hasPerformanceOverview = bodyText.includes('Performance Overview');
        const hasMarketingChannels = bodyText.includes('Marketing Channels');
        const hasConnectGoogleAnalytics = bodyText.includes('Connect Google Analytics');
        const hasConnectLeadConnector = bodyText.includes('Connect LeadConnector');

        // Check Sidebar
        const sidebar = document.querySelector('aside');
        const sidebarText = sidebar ? sidebar.innerText : '';
        const hasSlack = sidebarText.includes('Slack');
        const hasWhatsApp = sidebarText.includes('WhatsApp');
        const hasWorkspaceLinks = sidebarText.includes('WORKSPACE LINKS') || sidebarText.includes('Core & Docs') || sidebarText.includes('Website');

        // Check Client Details fields
        const hasCompanyName = bodyText.includes('Company Name');
        const hasOwner = bodyText.includes('Owner') || bodyText.includes('Client Owner');
        const hasIndustry = bodyText.includes('Industry');
        const hasServicePackage = bodyText.includes('Service Package');
        const hasOperationalManager = bodyText.includes('Operational Manager');
        const hasProjectStartDate = bodyText.includes('Project Start Date');
        const hasLifecycleStatus = bodyText.includes('Lifecycle Status') || bodyText.includes('Status');

        // Check disabled inputs in Client Details
        const formInputs = Array.from(document.querySelectorAll('main input, form input'));
        const areAllFormInputsDisabled = formInputs.length > 0
          ? formInputs.every(input => input.disabled)
          : true;

        const hasSaveChanges = bodyText.includes('Save Changes');
        const hasDiscardChanges = bodyText.includes('Discard Changes');
        const hasAddProfile = bodyText.includes('Add Profile');
        const hasArchiveZone = bodyText.includes('Archive Client Workspace');

        return {
          tabButtons,
          tabOrder,
          isOrderCorrect,
          isDetailsActive,
          hasSetupTab,
          hasWorkPlansTab,
          hasReportsTab,
          hasOldDashboardTab,
          hasPerformanceOverview,
          hasMarketingChannels,
          hasConnectGoogleAnalytics,
          hasConnectLeadConnector,
          hasSlack,
          hasWhatsApp,
          hasWorkspaceLinks,
          hasCompanyName,
          hasOwner,
          hasIndustry,
          hasServicePackage,
          hasOperationalManager,
          hasProjectStartDate,
          hasLifecycleStatus,
          formInputCount: formInputs.length,
          areAllFormInputsDisabled,
          hasSaveChanges,
          hasDiscardChanges,
          hasAddProfile,
          hasArchiveZone
        };
      });

      console.log(`[${client.name}] Initial Landing (Client Details) Check:`, initialLandingData);

      // Screenshot 1: Client Details
      const detailsScreenshotPath = path.join(ARTIFACT_DIR, `verify_reverted_${client.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_details.png`);
      await page.screenshot({ path: detailsScreenshotPath, fullPage: false });
      console.log(`Saved details screenshot: ${detailsScreenshotPath}`);

      // 2. Click 30-Day Setup tab to verify weeks & board
      await page.evaluate(() => {
        const btn = document.querySelector('button[data-testid="tab-setup"]');
        if (btn) btn.click();
      });
      await sleep(2000);

      const setupData = await page.evaluate(() => {
        const bodyText = document.body.innerText;

        // Check weeks
        const hasWeek1 = bodyText.includes('Week 1') || bodyText.includes('Social Media Optimization');
        const hasWeek2 = bodyText.includes('Week 2') || bodyText.includes('LinkedIn Optimization');
        const hasWeek3 = bodyText.includes('Week 3') || bodyText.includes('Funnel Setup');
        const hasWeek4 = bodyText.includes('Week 4') || bodyText.includes('Paid Ads Setup');

        // Check columns
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

      console.log(`[${client.name}] 30-Day Setup Check:`, setupData);

      // Screenshot 2: 30-Day Setup
      const setupScreenshotPath = path.join(ARTIFACT_DIR, `verify_reverted_${client.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_setup.png`);
      await page.screenshot({ path: setupScreenshotPath, fullPage: false });
      console.log(`Saved setup screenshot: ${setupScreenshotPath}`);

      // 3. Click 90-Day Work Plans tab
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

      // Evaluate client results
      const clientPass =
        initialLandingData.isOrderCorrect &&
        initialLandingData.isDetailsActive &&
        initialLandingData.hasSetupTab &&
        initialLandingData.hasWorkPlansTab &&
        !initialLandingData.hasReportsTab &&
        !initialLandingData.hasOldDashboardTab &&
        !initialLandingData.hasPerformanceOverview &&
        !initialLandingData.hasMarketingChannels &&
        initialLandingData.hasWorkspaceLinks &&
        initialLandingData.hasCompanyName &&
        !initialLandingData.hasSaveChanges &&
        !initialLandingData.hasDiscardChanges &&
        !initialLandingData.hasAddProfile &&
        !initialLandingData.hasArchiveZone &&
        initialLandingData.areAllFormInputsDisabled &&
        setupData.hasWeek1 &&
        setupData.hasPendingCol &&
        setupData.hasDoneCol &&
        !setupData.isAddTaskVisible &&
        !setupData.hasZohoVariations &&
        !setupData.hasReconciliationBanner &&
        !workPlansData.hasBuild90DayPlan &&
        !workPlansData.hasCreateFirstPlan;

      console.log(`>>> Client ${client.name} OVERALL RESULT: ${clientPass ? 'PASS' : 'FAIL'} <<<`);
      results.clientDetails[client.name] = {
        initialLandingData,
        setupData,
        workPlansData,
        pass: clientPass
      };

      if (!clientPass) {
        if (!initialLandingData.isOrderCorrect || !initialLandingData.isDetailsActive) results.check_1_tab_order_and_initial_client_details = false;
        if (initialLandingData.hasPerformanceOverview || initialLandingData.hasMarketingChannels || initialLandingData.hasOldDashboardTab) results.check_2_no_separate_dashboard_or_telemetry = false;
        if (!initialLandingData.hasWorkspaceLinks) results.check_3_full_staff_sidebar_rendered = false;
        if (initialLandingData.hasSaveChanges || initialLandingData.hasAddProfile || initialLandingData.hasArchiveZone || !initialLandingData.areAllFormInputsDisabled) results.check_4_client_details_tab_read_only = false;
        if (!setupData.hasWeek1 || !setupData.hasPendingCol || setupData.isAddTaskVisible) results.check_5_setup_tab_read_only_and_columns = false;
        if (workPlansData.hasBuild90DayPlan || workPlansData.hasCreateFirstPlan) results.check_6_workplans_tab_read_only = false;
        if (setupData.hasZohoVariations || setupData.hasReconciliationBanner) results.check_7_internal_materials_shielded = false;
        if (initialLandingData.hasReportsTab) results.check_8_monthly_reports_hidden_for_client = false;
      }
    }

    // Save JSON results artifact
    const jsonPath = path.join(ARTIFACT_DIR, 'reverted_client_view_production_verification.json');
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
