const puppeteer = require('puppeteer-core');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\Atif\\.gemini\\antigravity\\brain\\dc6b2411-97c2-4334-900a-7f5e6445dbb3';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  console.log('--- Starting Comprehensive Live Production Verification on ops.faseehlall.com ---');
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

  // Fill credentials
  await page.waitForSelector('input[type="email"]');
  await page.type('input[type="email"]', 'qa.owner.2fa@faseehlall.com');
  await page.type('input[type="password"]', 'QA2FAPassword2026!#');
  await page.click('button[type="submit"]');

  console.log('2. Logging in and waiting for app navigation...');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await sleep(3000);

  // 2. Test Finfix Pro View Client (Preview mode)
  console.log('3. Navigating to Finfix Pro View Client (preview=true)...');
  await page.goto('https://ops.faseehlall.com/clients/5d585580-d378-44a5-8dc1-d2653d4d6d8a?preview=true', {
    waitUntil: 'networkidle2'
  });
  await sleep(4000);

  // Check Finfix Pro Dashboard stats
  const finfixData = await page.evaluate(() => {
    const compEl = document.querySelector('[data-testid="stat-project-completion"]');
    const tasksEl = document.querySelector('[data-testid="stat-tasks-completed"]');
    const appEl = document.querySelector('[data-testid="stat-pending-approvals"]');
    const subEl = document.querySelector('[data-testid="stat-subscription"]');
    const sidebar = document.querySelector('[data-testid="finfix-client-sidebar"]');
    const searchBtn = document.querySelector('[data-testid="portal-search-button"]');
    const notifBtn = document.querySelector('[data-testid="portal-notifications-button"]');
    const notifBadge = document.querySelector('[data-testid="portal-notifications-badge"]');

    return {
      completionText: compEl ? compEl.innerText.trim() : null,
      tasksText: tasksEl ? tasksEl.innerText.trim() : null,
      approvalsText: appEl ? appEl.innerText.trim() : null,
      subscriptionText: subEl ? subEl.innerText.trim() : null,
      hasSidebar: Boolean(sidebar),
      hasSearchBtn: Boolean(searchBtn),
      hasNotifBtn: Boolean(notifBtn),
      hasNotifBadge: Boolean(notifBadge)
    };
  });

  console.log('Finfix Pro Portal Data:', finfixData);
  await page.screenshot({ path: `${ARTIFACT_DIR}/verify_live_finfix_portal_fixed.png`, fullPage: false });

  // 3. Test Problem 1: Search Modal
  console.log('4. Testing Problem 1: Search button click & filter...');
  await page.click('[data-testid="portal-search-button"]');
  await sleep(1000);
  const searchModalVisible = await page.evaluate(() => {
    const modal = document.querySelector('[data-testid="portal-search-modal"]');
    const input = document.querySelector('[data-testid="portal-search-input"]');
    return { hasModal: Boolean(modal), hasInput: Boolean(input) };
  });
  console.log('Search Modal State:', searchModalVisible);
  await page.type('[data-testid="portal-search-input"]', 'Company');
  await sleep(1000);
  await page.screenshot({ path: `${ARTIFACT_DIR}/verify_live_search_modal.png` });
  await page.keyboard.press('Escape');
  await sleep(800);

  // 4. Test Problem 2: Notifications Bell Dropdown
  console.log('5. Testing Problem 2: Notification bell click & panel...');
  await page.click('[data-testid="portal-notifications-button"]');
  await sleep(1000);
  const notifPanelVisible = await page.evaluate(() => {
    const panel = document.querySelector('[data-testid="portal-notifications-panel"]');
    return { hasPanel: Boolean(panel), text: panel ? panel.innerText.trim() : '' };
  });
  console.log('Notifications Panel State:', notifPanelVisible.hasPanel, notifPanelVisible.text.slice(0, 100));
  await page.screenshot({ path: `${ARTIFACT_DIR}/verify_live_notifications_dropdown.png` });
  await page.click('[data-testid="portal-notifications-button"]'); // close
  await sleep(800);

  // 5. Test Problem 5: Recent Activity View All Modal
  console.log('6. Testing Problem 5: Recent Activity "View All" modal...');
  await page.click('[data-testid="recent-activity-view-all"]');
  await sleep(1000);
  const recentModalVisible = await page.evaluate(() => {
    const modal = document.querySelector('[data-testid="recent-activity-modal"]');
    return { hasModal: Boolean(modal), text: modal ? modal.innerText.trim() : '' };
  });
  console.log('Recent Activity Modal State:', recentModalVisible.hasModal, recentModalVisible.text.slice(0, 100));
  await page.screenshot({ path: `${ARTIFACT_DIR}/verify_live_recent_activity_modal.png` });
  await page.evaluate(() => {
    const closeBtn = document.querySelector('[data-testid="recent-activity-modal"] button');
    if (closeBtn) closeBtn.click();
  });
  await sleep(800);

  // 6. Test Problem 7: 30-Day Setup & 90-Day Work Plans unified layout
  console.log('7. Testing Problem 7: 30-Day Setup tab in unified layout...');
  await page.click('[data-testid="tab-setup"]');
  await sleep(2000);
  const setupUnifiedData = await page.evaluate(() => {
    const sidebar = document.querySelector('[data-testid="finfix-client-sidebar"]');
    const statComp = document.querySelector('[data-testid="stat-project-completion"]');
    const stepper = document.querySelector('[data-testid="client-week-stepper"]');
    const activeStep = document.querySelector('[data-testid="week-step-1"]');
    const kanbanPending = document.querySelector('[data-testid="kanban-column-pending"]');
    return {
      hasSidebar: Boolean(sidebar),
      hasStatCards: Boolean(statComp),
      hasStepper: Boolean(stepper),
      stepperClasses: activeStep ? activeStep.className : '',
      hasKanban: Boolean(kanbanPending),
      kanbanClasses: kanbanPending ? kanbanPending.className : ''
    };
  });
  console.log('30-Day Setup Unified Layout:', setupUnifiedData);
  await page.screenshot({ path: `${ARTIFACT_DIR}/verify_live_setup_unified.png` });

  console.log('8. Testing Problem 7: 90-Day Work Plans tab in unified layout...');
  await page.click('[data-testid="tab-workplans"]');
  await sleep(2000);
  const workplansUnifiedData = await page.evaluate(() => {
    const sidebar = document.querySelector('[data-testid="finfix-client-sidebar"]');
    const statComp = document.querySelector('[data-testid="stat-project-completion"]');
    return {
      hasSidebar: Boolean(sidebar),
      hasStatCards: Boolean(statComp)
    };
  });
  console.log('90-Day Work Plans Unified Layout:', workplansUnifiedData);
  await page.screenshot({ path: `${ARTIFACT_DIR}/verify_live_workplans_unified.png` });

  // 7. Test Maven Professionals (8e5d17bf-1ba9-41e1-9ef7-09ca137a72d3)
  console.log('9. Checking Maven Professionals (preview=true)...');
  await page.goto('https://ops.faseehlall.com/clients/8e5d17bf-1ba9-41e1-9ef7-09ca137a72d3?preview=true', {
    waitUntil: 'networkidle2'
  });
  await sleep(3500);
  const mavenData = await page.evaluate(() => {
    const tasksEl = document.querySelector('[data-testid="stat-tasks-completed"]');
    const appEl = document.querySelector('[data-testid="stat-pending-approvals"]');
    const notifBadge = document.querySelector('[data-testid="portal-notifications-badge"]');
    return {
      tasksText: tasksEl ? tasksEl.innerText.trim() : null,
      approvalsText: appEl ? appEl.innerText.trim() : null,
      badgeText: notifBadge ? notifBadge.innerText.trim() : null
    };
  });
  console.log('Maven Professionals Live Data:', mavenData);
  await page.screenshot({ path: `${ARTIFACT_DIR}/verify_live_maven_portal_fixed.png` });

  // 8. Test Pixel Algos (5b9ea614-9b21-4b26-9c17-a8fa98b451c8)
  console.log('10. Checking Pixel Algos...');
  await page.goto('https://ops.faseehlall.com/clients/5b9ea614-9b21-4b26-9c17-a8fa98b451c8?preview=true', {
    waitUntil: 'networkidle2'
  });
  await sleep(3000);
  const pixelData = await page.evaluate(() => {
    const tasksEl = document.querySelector('[data-testid="stat-tasks-completed"]');
    return { tasksText: tasksEl ? tasksEl.innerText.trim() : null };
  });
  console.log('Pixel Algos Live Data:', pixelData);

  // 9. Test Archived Client (Books2Clear 753a7220-117e-448c-810c-0aee3da6b15c)
  console.log('11. Checking Archived Client Books2Clear (Dashboard tab must NOT exist)...');
  await page.goto('https://ops.faseehlall.com/clients/753a7220-117e-448c-810c-0aee3da6b15c?preview=true', {
    waitUntil: 'networkidle2'
  });
  await sleep(3000);
  const archivedData = await page.evaluate(() => {
    const dashTab = document.querySelector('[data-testid="tab-dashboard"]');
    const banner = document.querySelector('[data-testid="client-portal-banner"]');
    return {
      hasDashboardTab: Boolean(dashTab),
      bannerText: banner ? banner.innerText.trim() : null
    };
  });
  console.log('Archived Client Data:', archivedData);
  await page.screenshot({ path: `${ARTIFACT_DIR}/verify_live_archived_books2clear.png` });

  await browser.close();
  console.log('--- Live Production Verification Complete ---');
})();
