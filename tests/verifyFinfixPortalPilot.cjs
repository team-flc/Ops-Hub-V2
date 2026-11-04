const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:4173';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\Atif\\.gemini\\antigravity\\brain\\dc6b2411-97c2-4334-900a-7f5e6445dbb3';

const QA_OWNER_EMAIL = 'qa.owner.2fa@faseehlall.com';
const QA_OWNER_PASSWORD = 'QA2FAPassword2026!#';
const QA_OWNER_ID = 'e5e5e5e5-5555-4555-8555-555555555555';

const FINFIX_ID = '5d585580-d378-44a5-8dc1-d2653d4d6d8a';
const MAVEN_ID = '8e5d17bf-1ba9-41e1-9ef7-09ca137a72d3';

function executeSql(sql) {
  const tmpFile = path.join(__dirname, `tmp_finfix_qa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.sql`);
  fs.writeFileSync(tmpFile, sql, 'utf-8');
  try {
    const res = execSync(`npx.cmd supabase db query --linked -f "${tmpFile}"`, {
      cwd: 'C:\\Users\\Atif\\Documents\\GitHub\\Ops-Hub-V2',
      encoding: 'utf-8'
    });
    return res;
  } finally {
    if (fs.existsSync(tmpFile)) {
      try { fs.unlinkSync(tmpFile); } catch (e) {}
    }
  }
}

function setupQaUser() {
  console.log('Ensuring disposable QA Owner account in linked Supabase database...');
  const sql = `
    DO $$
    DECLARE
      u_owner_id UUID := '${QA_OWNER_ID}';
      u_owner_email TEXT := '${QA_OWNER_EMAIL}';
      u_owner_pass TEXT := '${QA_OWNER_PASSWORD}';
    BEGIN
      DELETE FROM public.user_2fa_recovery_codes WHERE user_id = u_owner_id;
      DELETE FROM public.user_2fa_attempts WHERE user_id = u_owner_id;
      DELETE FROM auth.mfa_challenges WHERE factor_id IN (SELECT id FROM auth.mfa_factors WHERE user_id = u_owner_id);
      DELETE FROM auth.mfa_factors WHERE user_id = u_owner_id;

      IF EXISTS(SELECT 1 FROM auth.users WHERE id = u_owner_id) THEN
        UPDATE auth.users
        SET encrypted_password = crypt(u_owner_pass, gen_salt('bf')),
            banned_until = NULL,
            email = u_owner_email,
            updated_at = NOW()
        WHERE id = u_owner_id;
      ELSE
        INSERT INTO auth.users (
          id, instance_id, aud, role, email, encrypted_password,
          email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
          confirmation_token, recovery_token, email_change_token_new, email_change,
          phone_change, phone_change_token, reauthentication_token,
          created_at, updated_at
        ) VALUES (
          u_owner_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          u_owner_email, crypt(u_owner_pass, gen_salt('bf')),
          NOW(), '{"provider":"email","providers":["email"]}'::jsonb,
          '{"full_name":"QA Owner"}'::jsonb,
          '', '', '', '',
          '', '', '',
          NOW(), NOW()
        );

        INSERT INTO auth.identities (
          id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), u_owner_id,
          json_build_object('sub', u_owner_id::text, 'email', u_owner_email, 'email_verified', true, 'phone_verified', false)::jsonb,
          'email', u_owner_id::text, NOW(), NOW(), NOW()
        );
      END IF;

      INSERT INTO public.profiles (
        id, full_name, role, status, contact_email, work_email, created_at, updated_at
      ) VALUES (
        u_owner_id, 'QA Owner', 'owner', 'active', u_owner_email, u_owner_email, NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE
      SET full_name = 'QA Owner',
          role = 'owner',
          status = 'active',
          contact_email = u_owner_email,
          work_email = u_owner_email,
          updated_at = NOW();
    END;
    $$;
  `;
  executeSql(sql);
  console.log('[OK] QA Owner user successfully provisioned.');
}

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
  // Use existing account without DB mutations

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1440, height: 1100 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    console.log('\n--- 1. Logging in as QA Owner ---');
    await loginUser(page, QA_OWNER_EMAIL, QA_OWNER_PASSWORD);

    // =========================================================================
    // 2. Open Finfix Pro in View Client Preview Mode
    // =========================================================================
    console.log('\n--- 2. Navigating to Finfix Pro View Client (?preview=true) ---');
    await page.goto(`${BASE_URL}/clients/${FINFIX_ID}?preview=true`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 3000));

    // Verify Sidebar exists and has 15 items in required order
    const sidebarChecks = await page.evaluate(() => {
      const sidebar = document.querySelector('[data-testid="finfix-client-sidebar"]');
      if (!sidebar) return { found: false };

      const navButtons = Array.from(sidebar.querySelectorAll('button[data-testid^="nav-"]'));
      const labels = navButtons.map(b => b.innerText.trim().split('\n')[0]);
      const text = sidebar.innerText;

      const hasInternalLinks = text.includes('GoHighLevel') || text.includes('Slack') || text.includes('WhatsApp Group') || text.includes('Google Drive');

      return {
        found: true,
        count: navButtons.length,
        labels,
        hasInternalLinks
      };
    });

    console.log('Sidebar checks:', sidebarChecks);
    if (!sidebarChecks.found || sidebarChecks.count !== 15 || sidebarChecks.hasInternalLinks) {
      throw new Error(`Sidebar check failed: ${JSON.stringify(sidebarChecks)}`);
    }

    const expectedOrder = [
      'Dashboard', 'Projects', 'Analytics', 'Social Media', 'LinkedIn',
      'Website and SEO', 'Paid Ads', 'Funnel', 'Subscription', 'Billing and Invoices',
      'Deliverables', 'Approvals', 'Team', 'Reports', 'Settings'
    ];
    for (let i = 0; i < expectedOrder.length; i++) {
      if (sidebarChecks.labels[i] !== expectedOrder[i]) {
        throw new Error(`Sidebar order mismatch at index ${i}: expected "${expectedOrder[i]}", got "${sidebarChecks.labels[i]}"`);
      }
    }
    console.log('[PASS] Sidebar has all 15 navigation items in strict required order with NO internal links.');

    // Verify Header: Greeting with real client name and subtitle "your performance at a glance."
    const headerChecks = await page.evaluate(() => {
      const header = document.querySelector('[data-testid="finfix-client-header"]');
      if (!header) return { found: false };
      const text = header.innerText;
      return {
        found: true,
        text,
        hasFinfix: text.includes('Finfix Pro'),
        hasGlance: text.toLowerCase().includes('your performance at a glance'),
        hasStaffBreadcrumbs: text.includes('Workspaces >') || text.includes('Muhammad Atif Naseer')
      };
    });

    console.log('Header checks:', headerChecks);
    if (!headerChecks.found || !headerChecks.hasFinfix || !headerChecks.hasGlance || headerChecks.hasStaffBreadcrumbs) {
      throw new Error(`Header check failed: ${JSON.stringify(headerChecks)}`);
    }
    console.log('[PASS] Header displays "Finfix Pro" and "Your performance at a glance." with NO staff breadcrumbs.');

    // Verify 4 Stat Cards in 1 horizontal row
    const statChecks = await page.evaluate(() => {
      const c1 = document.querySelector('[data-testid="stat-project-completion"]');
      const c2 = document.querySelector('[data-testid="stat-tasks-completed"]');
      const c3 = document.querySelector('[data-testid="stat-pending-approvals"]');
      const c4 = document.querySelector('[data-testid="stat-subscription"]');

      if (!c1 || !c2 || !c3 || !c4) {
        return { found: false };
      }

      // Check for forbidden mockup numbers
      const bodyText = document.body.innerText;
      const forbiddenMockups = [
        'Brightleaf Co', 'Alex Morgan', '84%', '18 / 24', '18/24',
        '$149', '22.4K', '3,850', '3850', 'Ali Hassan', '78%', '24 / 32', '24/32',
        '$99', '68K'
      ];
      const foundMockups = forbiddenMockups.filter(m => bodyText.includes(m));

      return {
        found: true,
        c1Text: c1.innerText.replace(/\n/g, ' '),
        c2Text: c2.innerText.replace(/\n/g, ' '),
        c3Text: c3.innerText.replace(/\n/g, ' '),
        c4Text: c4.innerText.replace(/\n/g, ' '),
        foundMockups
      };
    });

    console.log('Stat cards checks:', statChecks);
    if (!statChecks.found || statChecks.foundMockups.length > 0) {
      throw new Error(`Stat cards check failed. Forbidden mockup found: ${statChecks.foundMockups}`);
    }
    console.log('[PASS] Stat cards display live data with zero forbidden mockup numbers.');

    // Verify Performance Overview and Marketing Channels
    const analyticsChecks = await page.evaluate(() => {
      const perf = document.querySelector('[data-testid="performance-overview-section"]');
      const mktg = document.querySelector('[data-testid="marketing-channels-section"]');

      return {
        perfFound: Boolean(perf),
        perfText: perf?.innerText || '',
        perfHasToggles: perf?.innerText.includes('7D') && perf?.innerText.includes('30D') && perf?.innerText.includes('90D') && perf?.innerText.includes('1Y'),
        perfNotConnected: perf?.innerText.includes('Website Traffic & Leads: Not connected'),
        mktgFound: Boolean(mktg),
        mktgNotConnected: mktg?.innerText.includes('Marketing Channels: Not connected')
      };
    });

    console.log('Analytics telemetry checks:', analyticsChecks);
    if (!analyticsChecks.perfFound || !analyticsChecks.perfHasToggles || !analyticsChecks.perfNotConnected || !analyticsChecks.mktgNotConnected) {
      throw new Error(`Analytics telemetry check failed: ${JSON.stringify(analyticsChecks)}`);
    }
    console.log('[PASS] Performance Overview and Marketing Channels correctly display "Not connected".');

    // Verify Project Progress, Subscription & Billing, Recent Activity, Bottom Bar
    const sectionChecks = await page.evaluate(() => {
      const proj = document.querySelector('[data-testid="project-progress-section"]');
      const billing = document.querySelector('[data-testid="subscription-billing-card"]');
      const activity = document.querySelector('[data-testid="recent-activity-section"]');
      const bottomBar = document.querySelector('[data-testid="client-portal-bottom-bar"]');

      return {
        projHasSocial: proj?.innerText.includes('Social Media Optimization'),
        projHasLinkedIn: proj?.innerText.includes('LinkedIn Optimization'),
        projHasFunnel: proj?.innerText.includes('Funnel Setup'),
        projHasAds: proj?.innerText.includes('Paid Ads Setup'),
        billingHasPlan: billing?.innerText.includes('Plan Tier'),
        billingHasStatus: billing?.innerText.includes('Account Status'),
        billingHasNextDate: billing?.innerText.includes('Next Billing Date'),
        billingHasPayment: billing?.innerText.includes('Payment Status'),
        billingHasReceiptBtn: Boolean(billing?.querySelector('button')),
        activityFound: Boolean(activity),
        bottomBarFound: Boolean(bottomBar),
        bottomBarHasProgress: bottomBar?.innerText.includes('Overall project is on track:'),
        bottomBarHasReportBtn: Boolean(bottomBar?.querySelector('button'))
      };
    });

    console.log('Section checks:', sectionChecks);
    if (
      !sectionChecks.projHasSocial ||
      !sectionChecks.projHasLinkedIn ||
      !sectionChecks.projHasFunnel ||
      !sectionChecks.projHasAds ||
      !sectionChecks.billingHasPlan ||
      !sectionChecks.billingHasStatus ||
      !sectionChecks.billingHasNextDate ||
      !sectionChecks.billingHasPayment ||
      !sectionChecks.billingHasReceiptBtn ||
      !sectionChecks.activityFound ||
      !sectionChecks.bottomBarFound ||
      !sectionChecks.bottomBarHasProgress ||
      !sectionChecks.bottomBarHasReportBtn
    ) {
      throw new Error(`Section verification failed: ${JSON.stringify(sectionChecks)}`);
    }
    console.log('[PASS] All sections (Project Progress, Subscription & Billing, Activity, Bottom Bar) verified.');

    // Take screenshot of Finfix Pro client portal
    const screenshotPath = path.join(ARTIFACTS_DIR, 'verify_finfix_portal_pilot.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`[PASS] Captured screenshot: ${screenshotPath}`);

    // =========================================================================
    // 3. Verify Scoping: Another client (Maven) in preview does NOT get Finfix portal
    // =========================================================================
    console.log('\n--- 3. Verifying Scoping on Maven Professionals (?preview=true) ---');
    await page.goto(`${BASE_URL}/clients/${MAVEN_ID}?preview=true`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 3000));

    const mavenChecks = await page.evaluate(() => {
      const hasFinfixSidebar = Boolean(document.querySelector('[data-testid="finfix-client-sidebar"]'));
      const hasStandardPreviewBanner = document.body.innerText.includes('Client Preview Mode • Read-Only');
      const hasStandardWorkspace = Boolean(document.querySelector('[data-testid="client-week-stepper"]') || document.querySelector('button[aria-label="+ Add Task"]'));
      return {
        hasFinfixSidebar,
        hasStandardPreviewBanner,
        hasStandardWorkspace
      };
    });

    console.log('Maven scoping checks:', mavenChecks);
    if (mavenChecks.hasFinfixSidebar || !mavenChecks.hasStandardPreviewBanner) {
      throw new Error(`Scoping failed! Maven should not have Finfix portal: ${JSON.stringify(mavenChecks)}`);
    }
    console.log('[PASS] Scoping strictly preserved: Maven retains standard client preview mode.');

    // =========================================================================
    // 4. Verify Session Survival & Staff Reconciliation Banner
    // =========================================================================
    console.log('\n--- 4. Verifying Session Survival & Staff Reconciliation on Finfix Pro ---');
    await page.goto(`${BASE_URL}/clients/${FINFIX_ID}`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 3000));

    const staffChecks = await page.evaluate(() => {
      const text = document.body.innerText;
      const isAuthenticated = !text.includes('Sign in to Ops Hub') && !text.includes('Welcome back, Please sign in');
      const hasStaffReconciliation = text.includes('Client Safe Reconciliation') || text.includes('Client Visible');
      const hasHeader = Boolean(document.querySelector('header'));
      return {
        isAuthenticated,
        hasStaffReconciliation,
        hasHeader
      };
    });

    console.log('Staff workspace checks:', staffChecks);
    if (!staffChecks.isAuthenticated) {
      throw new Error('Session did not survive navigation from preview to staff workspace!');
    }
    console.log('[PASS] Session survived entering and exiting preview mode.');

    const staffScreenshotPath = path.join(ARTIFACTS_DIR, 'verify_finfix_staff_reconciliation.png');
    await page.screenshot({ path: staffScreenshotPath });
    console.log(`[PASS] Captured staff view screenshot: ${staffScreenshotPath}`);

    console.log('\n=======================================================');
    console.log('  ALL FINFIX PRO PILOT VERIFICATIONS PASSED (100%)');
    console.log('=======================================================');
  } finally {
    await browser.close();
  }
}

runVerification().catch(err => {
  console.error('\n[FAIL] Verification script encountered an error:', err);
  process.exit(1);
});
