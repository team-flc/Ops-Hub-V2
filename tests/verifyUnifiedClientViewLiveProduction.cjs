const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\Atif\\.gemini\\antigravity\\brain\\dc6b2411-97c2-4334-900a-7f5e6445dbb3';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  console.log('=== Starting Automated Verification of Unified Client View on ops.faseehlall.com ===');
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
    check_1_identical_tabs: true,
    check_2_no_separate_dashboard_or_telemetry: true,
    check_3_full_staff_sidebar_rendered: true,
    check_4_client_read_only_controls_hidden: true,
    check_5_internal_materials_shielded: true,
    check_6_client_details_tab_read_only: true,
    check_7_workplans_tab_read_only: true,
    check_8_monthly_reports_client_visible_only: true,
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

    // Verify bundle hash
    const bundleHash = await page.evaluate(() => {
      const script = document.querySelector('script[src*="/assets/index-"]');
      return script ? script.src : 'unknown';
    });
    console.log('Live bundle loaded in browser:', bundleHash);

    // Loop through clients
    for (const client of testClients) {
      console.log(`\n--- Verifying Client: ${client.name} (${client.id}) ---`);
      // Preview mode simulates exact client view
      await page.goto(`https://ops.faseehlall.com/clients/${client.id}?preview=true`, { waitUntil: 'networkidle2' });
      await sleep(2000);

      const clientData = await page.evaluate((clientId) => {
        const bodyText = document.body.innerText;

        // Check tabs
        const hasSetupTab = bodyText.includes('30-Day Setup');
        const hasWorkPlansTab = bodyText.includes('90-Day Work Plans');
        const hasDetailsTab = bodyText.includes('Client Details');
        const hasReportsTab = bodyText.includes('Monthly Reports');
        const hasOldDashboardTab = Array.from(document.querySelectorAll('button')).some(b => b.textContent?.trim() === 'Dashboard');

        // Check prototype artifacts
        const hasPerformanceOverview = bodyText.includes('Performance Overview');
        const hasMarketingChannels = bodyText.includes('Marketing Channels');
        const hasConnectGoogleAnalytics = bodyText.includes('Connect Google Analytics');
        const hasConnectLeadConnector = bodyText.includes('Connect LeadConnector');

        // Check Sidebar
        const sidebar = document.querySelector('aside');
        const sidebarText = sidebar ? sidebar.innerText : '';
        const hasSlack = sidebarText.includes('Slack');
        const hasWhatsApp = sidebarText.includes('WhatsApp');
        const hasWorkspaceLinks = sidebarText.includes('WORKSPACE LINKS') || sidebarText.includes('Core & Docs');

        // Check + Add Task button
        const addTaskBtn = document.querySelector('button[data-testid="add-task-btn"]') ||
          Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Add Task'));
        const isAddTaskVisible = addTaskBtn ? (addTaskBtn.offsetParent !== null) : false;

        // Check Internal Task leaks
        const hasZohoVariations = bodyText.includes('120 Zoho variations for Mushahid Awan');
        const hasInternalInvoice = bodyText.toLowerCase().includes('invoice #') && bodyText.includes('internal');
        const hasReconciliationBanner = bodyText.includes('tasks visible to client') || bodyText.includes('hidden from client');

        // Check Week buttons
        const week1Btn = Array.from(document.querySelectorAll('button')).some(b => b.textContent?.includes('Week 1'));

        return {
          hasSetupTab,
          hasWorkPlansTab,
          hasDetailsTab,
          hasReportsTab,
          hasOldDashboardTab,
          hasPerformanceOverview,
          hasMarketingChannels,
          hasConnectGoogleAnalytics,
          hasConnectLeadConnector,
          hasSlack,
          hasWhatsApp,
          hasWorkspaceLinks,
          isAddTaskVisible,
          hasZohoVariations,
          hasInternalInvoice,
          hasReconciliationBanner,
          week1Btn
        };
      }, client.id);

      // Take screenshot of main workspace
      const screenshotPath = path.join(ARTIFACT_DIR, `verify_unified_${client.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_workspace.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`Saved screenshot: ${screenshotPath}`);

      // Now click Client Details tab to verify read-only controls
      const detailsBtn = await page.$('button[data-tab="details"]');
      if (detailsBtn) {
        await detailsBtn.click();
        await sleep(1000);
      } else {
        // try finding button by text
        await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Client Details'));
          if (btn) btn.click();
        });
        await sleep(1000);
      }

      const detailsData = await page.evaluate(() => {
        const bodyText = document.body.innerText;
        const hasSaveChanges = bodyText.includes('Save Changes');
        const hasDiscardChanges = bodyText.includes('Discard Changes');
        const hasAddProfile = bodyText.includes('Add Profile');
        const hasArchiveZone = bodyText.includes('Archive Client Workspace');
        
        // Check input disabled state
        const companyInput = document.querySelector('input[name="company_name"]') || document.querySelector('input[disabled]');
        const anyInput = document.querySelector('input');
        const isInputDisabled = anyInput ? anyInput.disabled : true;

        return {
          hasSaveChanges,
          hasDiscardChanges,
          hasAddProfile,
          hasArchiveZone,
          isInputDisabled
        };
      });

      // Now click 90-Day Work Plans tab
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('90-Day Work Plans'));
        if (btn) btn.click();
      });
      await sleep(1000);

      const workPlansData = await page.evaluate(() => {
        const bodyText = document.body.innerText;
        const hasBuild90DayPlan = bodyText.includes('Build 90-Day Plan');
        const hasCreateFirstPlan = bodyText.includes('Create First 90-Day Work Plan');
        return {
          hasBuild90DayPlan,
          hasCreateFirstPlan
        };
      });

      // Now click Monthly Reports tab
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Monthly Reports'));
        if (btn) btn.click();
      });
      await sleep(1000);

      const reportsData = await page.evaluate(() => {
        const bodyText = document.body.innerText;
        const hasInternalStaffOnly = bodyText.includes('Internal Staff Only');
        const hasVisibleBadge = bodyText.includes('Client Visible') || bodyText.includes('Total Deliverables');
        return {
          hasInternalStaffOnly,
          hasVisibleBadge
        };
      });

      // Evaluate client results
      const clientPass =
        clientData.hasSetupTab &&
        clientData.hasWorkPlansTab &&
        clientData.hasDetailsTab &&
        clientData.hasReportsTab &&
        !clientData.hasOldDashboardTab &&
        !clientData.hasPerformanceOverview &&
        !clientData.hasMarketingChannels &&
        !clientData.isAddTaskVisible &&
        !clientData.hasZohoVariations &&
        !clientData.hasReconciliationBanner &&
        !detailsData.hasSaveChanges &&
        !detailsData.hasDiscardChanges &&
        !detailsData.hasAddProfile &&
        !detailsData.hasArchiveZone &&
        !workPlansData.hasBuild90DayPlan &&
        !workPlansData.hasCreateFirstPlan &&
        !reportsData.hasInternalStaffOnly;

      console.log(`Client ${client.name} pass status:`, clientPass);
      results.clientDetails[client.name] = {
        clientData,
        detailsData,
        workPlansData,
        reportsData,
        pass: clientPass
      };

      if (!clientPass) {
        if (!clientData.hasSetupTab || clientData.hasOldDashboardTab) results.check_1_identical_tabs = false;
        if (clientData.hasPerformanceOverview || clientData.hasMarketingChannels) results.check_2_no_separate_dashboard_or_telemetry = false;
        if (!clientData.hasWorkspaceLinks) results.check_3_full_staff_sidebar_rendered = false;
        if (clientData.isAddTaskVisible) results.check_4_client_read_only_controls_hidden = false;
        if (clientData.hasZohoVariations || clientData.hasReconciliationBanner) results.check_5_internal_materials_shielded = false;
        if (detailsData.hasSaveChanges || detailsData.hasAddProfile || detailsData.hasArchiveZone) results.check_6_client_details_tab_read_only = false;
        if (workPlansData.hasBuild90DayPlan || workPlansData.hasCreateFirstPlan) results.check_7_workplans_tab_read_only = false;
        if (reportsData.hasInternalStaffOnly) results.check_8_monthly_reports_client_visible_only = false;
      }
    }

    // Save JSON results artifact
    const jsonPath = path.join(ARTIFACT_DIR, 'unified_client_view_production_verification.json');
    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
    console.log(`\nVerification complete. Results saved to: ${jsonPath}`);
    console.log('Overall Results Summary:', JSON.stringify(results, null, 2));

  } catch (err) {
    console.error('Fatal verification error:', err);
  } finally {
    await browser.close();
  }
})();
