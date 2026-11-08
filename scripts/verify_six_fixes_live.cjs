const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const PROD_URL = 'https://ops.faseehlall.com';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\Atif\\.gemini\\antigravity\\brain\\dc6b2411-97c2-4334-900a-7f5e6445dbb3';

const QA_EMAIL = 'qa.owner.2fa@faseehlall.com';
const QA_PASSWORD = 'QA2FAPassword2026!#';

const CLOUD_Z_ID = 'd3d666c2-24c7-4cc7-b879-55c6d5881185';
const FINFIX_ID = '5d585580-d378-44a5-8dc1-d2653d4d6d8a';

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log('=== STARTING LIVE PRODUCTION E2E VERIFICATION ===');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1440, height: 1000 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Set download behavior to ARTIFACTS_DIR
  const client = await page.target().createCDPSession();
  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: ARTIFACTS_DIR
  });

  const results = {};

  try {
    // 1. Login
    console.log('\n1. Logging in with owner account...');
    await page.goto(`${PROD_URL}/login`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('input#work-email');
    await page.type('input#work-email', QA_EMAIL);
    await page.type('input#password', QA_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
    await delay(3500);

    // 2. ITEM 1: Client Workload Distribution Card on Main Dashboard
    console.log('\n2. Testing Item 1: Client Workload Distribution on Main Dashboard (/settings/dashboard)...');
    await page.goto(`${PROD_URL}/settings/dashboard`, { waitUntil: 'networkidle2' });
    await delay(3500);

    const workloadData = await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll('h3'));
      const workloadHeader = headers.find(h => h.innerText.includes('Client Operational Workload Distribution'));
      if (!workloadHeader) return null;
      const container = workloadHeader.closest('.p-5, .p-6') || workloadHeader.parentElement;
      const cards = Array.from(container.querySelectorAll('.p-3\\.5, .rounded-2xl'));
      const textList = cards.map(c => c.innerText.replace(/\n/g, ' '));
      return {
        cloudZ: textList.find(t => t.includes('Cloud Z Technologies')),
        solidBooks: textList.find(t => t.includes('Solid BooksLLC')),
        bizease: textList.find(t => t.includes('Bizease')),
        faseehLall: textList.find(t => t.includes('Faseeh Lall & Co'))
      };
    });

    console.log('Workload Results:', workloadData);
    const snapWorkload = path.join(ARTIFACTS_DIR, 'verify_live_workload_card_fixed.png');
    await page.screenshot({ path: snapWorkload });

    const item1Pass = Boolean(
      workloadData &&
      workloadData.cloudZ && workloadData.cloudZ.includes('3/6 Done (50%)') &&
      workloadData.solidBooks && workloadData.solidBooks.includes('1/38 Done (3%)') &&
      workloadData.bizease && workloadData.bizease.includes('0/12 Done (0%)') &&
      workloadData.faseehLall && workloadData.faseehLall.includes('0/24 Done (0%)')
    );
    results.item1_workload_cards = {
      passed: item1Pass,
      data: workloadData
    };

    // 3. ITEM 2: Trending line removal & Real Status line
    console.log('\n3. Testing Item 2: Trending Line Removal on Cloud Z & Finfix Pro (?preview=true)...');
    await page.goto(`${PROD_URL}/clients/${CLOUD_Z_ID}?preview=true`, { waitUntil: 'networkidle2' });
    await delay(3500);

    const cloudZBottomBar = await page.evaluate(() => {
      const bb = document.querySelector('[data-testid="client-portal-bottom-bar"]');
      return bb ? bb.innerText.replace(/\n/g, ' ') : '';
    });
    console.log('Cloud Z bottom bar text:', cloudZBottomBar);

    await page.goto(`${PROD_URL}/clients/${FINFIX_ID}?preview=true`, { waitUntil: 'networkidle2' });
    await delay(3500);

    const finfixBottomBar = await page.evaluate(() => {
      const bb = document.querySelector('[data-testid="client-portal-bottom-bar"]');
      return bb ? bb.innerText.replace(/\n/g, ' ') : '';
    });
    console.log('Finfix bottom bar text:', finfixBottomBar);

    const demoString = "You're on the right track! Campaign performance is trending up this month.";
    const item2Pass =
      !cloudZBottomBar.includes(demoString) &&
      !finfixBottomBar.includes(demoString) &&
      cloudZBottomBar.includes('completed') &&
      !finfixBottomBar.includes('trending up');

    results.item2_no_demo_trending_line = {
      passed: item2Pass,
      cloudZBottomBar,
      finfixBottomBar
    };

    // 4. ITEM 3: Marketing Channels & Performance Overview Charts
    console.log('\n4. Testing Item 3: Marketing Channels & Performance Overview Charts...');
    // Finfix Pro (Unconnected)
    const finfixMktgPerf = await page.evaluate(() => {
      const mktg = document.querySelector('[data-testid="marketing-channels-section"]');
      const perf = document.querySelector('[data-testid="performance-overview-section"]');
      return {
        mktgText: mktg ? mktg.innerText.replace(/\n/g, ' ') : '',
        perfText: perf ? perf.innerText.replace(/\n/g, ' ') : '',
        hasConnectWebsite: Boolean(mktg && mktg.innerText.includes('+ Connect Website')),
        hasConnectMeta: Boolean(mktg && mktg.innerText.includes('+ Connect Meta'))
      };
    });
    console.log('Finfix (Unconnected):', finfixMktgPerf);
    const snapUnconnected = path.join(ARTIFACTS_DIR, 'verify_live_marketing_channels_unconnected.png');
    await page.screenshot({ path: snapUnconnected });

    // Cloud Z (Connected)
    await page.goto(`${PROD_URL}/clients/${CLOUD_Z_ID}?preview=true`, { waitUntil: 'networkidle2' });
    await delay(3500);

    const cloudZMktgPerf = await page.evaluate(() => {
      const mktg = document.querySelector('[data-testid="marketing-channels-section"]');
      const perf = document.querySelector('[data-testid="performance-overview-section"]');
      const hasDonut = Boolean(mktg && mktg.querySelector('svg circle[stroke-dasharray]'));
      const hasLineChart = Boolean(perf && perf.querySelector('svg path[stroke="#0D9488"]'));
      return {
        mktgText: mktg ? mktg.innerText.replace(/\n/g, ' ') : '',
        perfText: perf ? perf.innerText.replace(/\n/g, ' ') : '',
        hasDonut,
        hasLineChart
      };
    });
    console.log('Cloud Z (Connected):', cloudZMktgPerf);
    const snapConnected = path.join(ARTIFACTS_DIR, 'verify_live_marketing_channels_connected.png');
    await page.screenshot({ path: snapConnected });

    const item3Pass =
      finfixMktgPerf.mktgText.includes('Not connected') &&
      finfixMktgPerf.hasConnectWebsite &&
      finfixMktgPerf.hasConnectMeta &&
      cloudZMktgPerf.hasDonut &&
      cloudZMktgPerf.hasLineChart;

    results.item3_marketing_and_performance_charts = {
      passed: item3Pass,
      finfix: finfixMktgPerf,
      cloudZ: cloudZMktgPerf
    };

    // 5. ITEM 4: Monthly Reports in Client & Staff Views
    console.log('\n5. Testing Item 4: Dedicated Monthly Reports Source & Views...');
    // Client view: click 'Reports'
    await page.click('[data-testid="nav-reports"]');
    await delay(2000);

    const clientReportsData = await page.evaluate(() => {
      const view = document.querySelector('[data-testid="client-reports-view"]');
      return {
        viewFound: Boolean(view),
        text: view ? view.innerText.replace(/\n/g, ' ') : '',
        hasOctoberCard: Boolean(view && view.innerText.includes('October 2026 Monthly Report')),
        hasEmptyNovember: Boolean(view && view.innerText.includes('No monthly report for November 2026'))
      };
    });
    console.log('Client Reports View Data:', clientReportsData);
    const snapClientReports = path.join(ARTIFACTS_DIR, 'verify_live_reports_client_view.png');
    await page.screenshot({ path: snapClientReports });

    // Staff view: open Cloud Z without preview=true
    await page.goto(`${PROD_URL}/clients/${CLOUD_Z_ID}`, { waitUntil: 'networkidle2' });
    await delay(3500);

    // Click Monthly Reports tab in staff view
    await page.click('[data-testid="tab-reports"]');
    await delay(2000);

    const staffReportsData = await page.evaluate(() => {
      const view = document.querySelector('[data-testid="staff-reports-view"]');
      return {
        viewFound: Boolean(view),
        text: view ? view.innerText.replace(/\n/g, ' ') : '',
        hasOctoberCard: Boolean(view && view.innerText.includes('October 2026 Monthly Report')),
        hasEmptyNovember: Boolean(view && view.innerText.includes('No monthly report for November 2026')),
        isStaffSynchronizedBadge: Boolean(view && view.innerText.includes('Staff Synchronized'))
      };
    });
    console.log('Staff Reports View Data:', staffReportsData);
    const snapStaffReports = path.join(ARTIFACTS_DIR, 'verify_live_reports_staff_view.png');
    await page.screenshot({ path: snapStaffReports });

    const item4Pass =
      clientReportsData.hasOctoberCard &&
      clientReportsData.hasEmptyNovember &&
      staffReportsData.hasOctoberCard &&
      staffReportsData.hasEmptyNovember &&
      staffReportsData.isStaffSynchronizedBadge;

    results.item4_monthly_reports_sync = {
      passed: item4Pass,
      clientReportsData,
      staffReportsData
    };

    // 6. ITEM 5: Cloud Z Recent Activity Dates (Oct 15, 2026)
    console.log('\n6. Testing Item 5: Cloud Z Recent Activity Date Match (Oct 15, 2026)...');
    await page.goto(`${PROD_URL}/clients/${CLOUD_Z_ID}?preview=true`, { waitUntil: 'networkidle2' });
    await delay(3500);

    const previewActivityData = await page.evaluate(() => {
      const sec = document.querySelector('[data-testid="recent-activity-section"]');
      return sec ? sec.innerText : '';
    });
    console.log('Preview Activity Text snippet:', previewActivityData.replace(/\n/g, ' ').slice(0, 250));

    // Open View All modal
    await page.click('[data-testid="recent-activity-view-all"]');
    await delay(1500);

    const modalActivityData = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="recent-activity-modal"]');
      return modal ? modal.innerText : '';
    });
    console.log('Modal Activity Text snippet:', modalActivityData.replace(/\n/g, ' ').slice(0, 250));
    const snapModal = path.join(ARTIFACTS_DIR, 'verify_live_recent_activity_modal_date_match.png');
    await page.screenshot({ path: snapModal });

    // Close modal
    const closeBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('[data-testid="recent-activity-modal"] button'));
      return buttons.find(b => b.innerText.includes('Close') || b.querySelector('svg'));
    });
    if (closeBtn) await closeBtn.click();
    await delay(500);

    // Both preview list and modal must contain Oct 15, 2026 for completed deliverables
    const item5Pass =
      previewActivityData.includes('Oct 15, 2026') &&
      modalActivityData.includes('Oct 15, 2026');

    results.item5_recent_activity_date_match = {
      passed: item5Pass,
      previewHasOct15: previewActivityData.includes('Oct 15, 2026'),
      modalHasOct15: modalActivityData.includes('Oct 15, 2026')
    };

    // 7. ITEM 6: Real File Downloads & Toast Feedback
    console.log('\n7. Testing Item 6: Real File Downloads & Toast Feedback...');
    // Click Download Receipt
    const downloadReceiptBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => b.innerText.includes('Download Receipt'));
    });
    if (downloadReceiptBtn) {
      await downloadReceiptBtn.click();
      await delay(1500);
    }

    const toastReceipt = await page.evaluate(() => {
      return document.body.innerText.includes('Official receipt downloaded successfully');
    });
    console.log('Toast Receipt status:', toastReceipt);

    // Click Download Monthly Report
    const downloadReportBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => b.innerText.includes('Download Monthly Report'));
    });
    if (downloadReportBtn) {
      await downloadReportBtn.click();
      await delay(1500);
    }

    const toastReport = await page.evaluate(() => {
      return document.body.innerText.includes('Monthly Report downloaded successfully');
    });
    console.log('Toast Report status:', toastReport);

    // Check files downloaded in ARTIFACTS_DIR
    const files = fs.readdirSync(ARTIFACTS_DIR);
    const downloadedTxtFiles = files.filter(f => f.endsWith('.txt'));
    console.log('Downloaded .txt files found:', downloadedTxtFiles);

    const item6Pass = toastReceipt && toastReport && downloadedTxtFiles.length > 0;
    results.item6_real_downloads = {
      passed: item6Pass,
      toastReceipt,
      toastReport,
      downloadedTxtFiles
    };

    console.log('\n=== COMPREHENSIVE E2E VERIFICATION REPORT ===');
    console.log(JSON.stringify(results, null, 2));

    const allPassed =
      results.item1_workload_cards.passed &&
      results.item2_no_demo_trending_line.passed &&
      results.item3_marketing_and_performance_charts.passed &&
      results.item4_monthly_reports_sync.passed &&
      results.item5_recent_activity_date_match.passed &&
      results.item6_real_downloads.passed;

    console.log('\nOVERALL RESULT: ' + (allPassed ? 'ALL 6 ITEMS PASSED ON PRODUCTION!' : 'SOME ITEMS FAILED'));

    // Save results artifact
    fs.writeFileSync(
      path.join(ARTIFACTS_DIR, 'six_mistakes_verification_results.json'),
      JSON.stringify(results, null, 2)
    );

  } catch (err) {
    console.error('Test run failed with error:', err);
  } finally {
    await browser.close();
  }
}

run();
