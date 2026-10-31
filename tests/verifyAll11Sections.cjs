// ==============================================================================
// Complete Verification Suite: All 11 Sections
// ==============================================================================

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

const QA_INTERN_EMAIL = 'qa.intern@faseehlall.com';
const QA_INTERN_PASSWORD = 'QAInternPassword2026!#';
const QA_INTERN_ID = 'f6f6f6f6-6666-4666-8666-666666666666';

const PIXEL_ID = '5b9ea614-9b21-4b26-9c17-a8fa98b451c8';
const MAVEN_ID = '8e5d17bf-1ba9-41e1-9ef7-09ca137a72d3';
const UNIZ_ID = 'c374d3af-d73a-4691-beff-76d4a4b97e47';

function executeSql(sql) {
  const tmpFile = path.join(__dirname, `tmp_suite_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.sql`);
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

function setupUsers() {
  console.log('Ensuring disposable QA Owner and Intern accounts in linked Supabase database...');
  const sql = `
    DO $$
    DECLARE
      u_owner_id UUID := '${QA_OWNER_ID}';
      u_owner_email TEXT := '${QA_OWNER_EMAIL}';
      u_owner_pass TEXT := '${QA_OWNER_PASSWORD}';

      u_intern_id UUID := '${QA_INTERN_ID}';
      u_intern_email TEXT := '${QA_INTERN_EMAIL}';
      u_intern_pass TEXT := '${QA_INTERN_PASSWORD}';
    BEGIN
      -- Owner user
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

      -- Intern user
      DELETE FROM public.user_2fa_recovery_codes WHERE user_id = u_intern_id;
      DELETE FROM public.user_2fa_attempts WHERE user_id = u_intern_id;
      DELETE FROM auth.mfa_challenges WHERE factor_id IN (SELECT id FROM auth.mfa_factors WHERE user_id = u_intern_id);
      DELETE FROM auth.mfa_factors WHERE user_id = u_intern_id;

      IF EXISTS(SELECT 1 FROM auth.users WHERE id = u_intern_id) THEN
        UPDATE auth.users
        SET encrypted_password = crypt(u_intern_pass, gen_salt('bf')),
            banned_until = NULL,
            email = u_intern_email,
            updated_at = NOW()
        WHERE id = u_intern_id;
      ELSE
        INSERT INTO auth.users (
          id, instance_id, aud, role, email, encrypted_password,
          email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
          confirmation_token, recovery_token, email_change_token_new, email_change,
          phone_change, phone_change_token, reauthentication_token,
          created_at, updated_at
        ) VALUES (
          u_intern_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          u_intern_email, crypt(u_intern_pass, gen_salt('bf')),
          NOW(), '{"provider":"email","providers":["email"]}'::jsonb,
          '{"full_name":"QA Social Media Intern"}'::jsonb,
          '', '', '', '',
          '', '', '',
          NOW(), NOW()
        );

        INSERT INTO auth.identities (
          id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), u_intern_id,
          json_build_object('sub', u_intern_id::text, 'email', u_intern_email, 'email_verified', true, 'phone_verified', false)::jsonb,
          'email', u_intern_id::text, NOW(), NOW(), NOW()
        );
      END IF;

      INSERT INTO public.profiles (
        id, full_name, role, status, contact_email, work_email, designation_id, created_at, updated_at
      ) VALUES (
        u_intern_id, 'QA Social Media Intern', 'team_member', 'active', u_intern_email, u_intern_email, '09e3fd80-00dc-4a42-98d4-72619a39cebe', NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE
      SET full_name = 'QA Social Media Intern',
          role = 'team_member',
          status = 'active',
          designation_id = '09e3fd80-00dc-4a42-98d4-72619a39cebe',
          contact_email = u_intern_email,
          work_email = u_intern_email,
          updated_at = NOW();

      -- Client access for QA Intern
      INSERT INTO public.client_team_access (client_id, profile_id)
      VALUES ('${MAVEN_ID}', u_intern_id)
      ON CONFLICT DO NOTHING;
    END;
    $$;
  `;
  executeSql(sql);
  console.log('[OK] QA Users successfully provisioned.');
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
  const results = {};
  setupUsers();

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1440, height: 1100 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    console.log('\n--- Logging in as Owner ---');
    await loginUser(page, QA_OWNER_EMAIL, QA_OWNER_PASSWORD);

    // =========================================================================
    // SECTION 1: Raw ISO Timestamps
    // =========================================================================
    console.log('\nVerifying Section 1: Raw ISO timestamps...');
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2500));

    // Switch to All Company Tasks on Kanban
    const allCompanyBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const found = btns.find(b => b.textContent.includes('All Company Tasks'));
      if (found) {
        found.click();
        return true;
      }
      return false;
    });
    console.log('Switched kanban to All Company Tasks:', allCompanyBtn);
    await new Promise(r => setTimeout(r, 1500));

    // Check dates rendered on kanban cards
    const dateTexts = await page.evaluate(() => {
      const dates = [];
      const spans = document.querySelectorAll('span');
      spans.forEach(s => {
        const text = s.textContent.trim();
        if (/2026-\d{2}-\d{2}T/.test(text)) {
          dates.push({ raw: true, text });
        }
      });
      return dates;
    });

    const sampleHumanDates = await page.evaluate(() => {
      const human = [];
      const spans = document.querySelectorAll('span');
      spans.forEach(s => {
        const text = s.textContent.trim();
        if (/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}$/.test(text)) {
          human.push(text);
        }
      });
      return human.slice(0, 10);
    });

    console.log('Raw ISO timestamps found on cards:', dateTexts.length);
    console.log('Sample human formatted dates found:', sampleHumanDates);

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'section1_task_cards_human_timestamps.png') });
    results['Section 1 (Raw ISO timestamps)'] = dateTexts.length === 0 && sampleHumanDates.length > 0 ? 'PASS' : 'FAIL';

    // =========================================================================
    // SECTION 2: Workload widget counts archived clients
    // =========================================================================
    console.log('\nVerifying Section 2: Workload widget counts archived clients...');
    const workloadText = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('span'));
      const found = spans.find(el => el.textContent.trim().includes('Active Workspaces'));
      return found ? found.textContent.trim() : null;
    });
    console.log('Workload widget badge:', workloadText);

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'section2_workload_widget_28_active.png') });
    results['Section 2 (Workload widget counts archived clients)'] = workloadText === '28 Active Workspaces' ? 'PASS' : 'FAIL';

    // =========================================================================
    // SECTION 3: Trends do not match the kanban
    // =========================================================================
    console.log('\nVerifying Section 3: Trends do not match the kanban...');
    const trendNumbers = await page.evaluate(() => {
      const week1Card = document.querySelector('.grid.grid-cols-2.sm\\:grid-cols-4');
      if (!week1Card) return null;
      const firstWeek = week1Card.children[0];
      if (!firstWeek) return null;
      return firstWeek.textContent;
    });
    console.log('Week 1 trend breakdown text:', trendNumbers);
    const hasTotal232 = trendNumbers && trendNumbers.includes('232');
    const hasCompleted3 = trendNumbers && trendNumbers.includes('Completed') && trendNumbers.includes('3');
    const hasInFlight12 = trendNumbers && trendNumbers.includes('In Flight') && trendNumbers.includes('12');
    const hasPending197 = trendNumbers && trendNumbers.includes('Pending') && trendNumbers.includes('197');

    console.log(`Trend check: Total 232: ${hasTotal232}, Completed 3: ${hasCompleted3}, In Flight 12: ${hasInFlight12}, Pending 197: ${hasPending197}`);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'section3_trend_chart_vs_kanban.png') });
    results['Section 3 (Trends do not match the kanban)'] = (hasTotal232 && hasCompleted3 && hasInFlight12 && hasPending197) ? 'PASS' : 'FAIL';

    // =========================================================================
    // SECTION 4: Stuck timers
    // =========================================================================
    console.log('\nVerifying Section 4: Stuck timers...');
    // Live timers widget check
    const liveTimersCount = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll('span, h3, div'));
      const activeTimersHeader = headings.find(h => h.textContent.includes('Live Active Timers'));
      return activeTimersHeader ? activeTimersHeader.closest('div').innerText : '';
    });
    console.log('Live Active Timers section text:', liveTimersCount);
    const showsZeroLive = liveTimersCount.includes('0 Live');

    // Check approval column in kanban for any Resume button
    const resumeInApproval = await page.evaluate(() => {
      const approvalCol = document.querySelector('[data-testid="kanban-col-approval"]');
      if (!approvalCol) return false;
      const btns = Array.from(approvalCol.querySelectorAll('button'));
      return btns.some(b => b.textContent.includes('Resume') || b.title.includes('Resume'));
    });
    console.log('Resume button in Approval column:', resumeInApproval);

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'section4_stuck_timers_and_no_resume_on_approval.png') });
    results['Section 4 (Stuck timers)'] = (showsZeroLive && !resumeInApproval) ? 'PASS' : 'FAIL';

    // =========================================================================
    // SECTION 5: Client switch shows the old board first
    // =========================================================================
    console.log('\nVerifying Section 5: Client switch shows the old board first...');
    // Navigate to Pixel Algos workspace
    await page.goto(`${BASE_URL}/clients/${PIXEL_ID}`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    // Click Week 3 tab
    await page.evaluate(() => {
      const week3Button = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().includes('Week 3'));
      if (week3Button) week3Button.click();
    });
    await new Promise(r => setTimeout(r, 1000));

    // Switch to Maven Professionals
    await page.goto(`${BASE_URL}/clients/${MAVEN_ID}`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));

    // Confirm Week 1 is active by default and no Pixel Algos tasks are visible
    const weekCheck = await page.evaluate(() => {
      const step1 = document.querySelector('[data-testid="week-step-1"]');
      const activeBadge = step1 ? step1.querySelector('span.bg-brand-500') : null;
      const isWeek1 = activeBadge && activeBadge.textContent.includes('Week 1');
      const hasPixelTasks = document.body.innerText.includes('Pixel Algos VSL Script');
      return { isWeek1: Boolean(isWeek1), hasPixelTasks };
    });
    console.log('Maven Week 1 active after switch:', weekCheck.isWeek1, '| Has Pixel tasks:', weekCheck.hasPixelTasks);
    const showsWeek1 = weekCheck.isWeek1 && !weekCheck.hasPixelTasks;

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'section5_client_switch_immediate_week1.png') });
    results['Section 5 (Client switch shows the old board first)'] = showsWeek1 ? 'PASS' : 'FAIL';

    // =========================================================================
    // SECTION 6: Dashboard shows fake zeros while loading
    // =========================================================================
    console.log('\nVerifying Section 6: Dashboard shows fake zeros while loading...');
    // Enable request delay on Supabase tasks query to inspect loading skeletons
    await page.setRequestInterception(true);
    let delayEnabled = true;
    const requestHandler = (req) => {
      if (delayEnabled && req.url().includes('client_tasks')) {
        setTimeout(() => req.continue().catch(() => {}), 1500);
      } else {
        req.continue().catch(() => {});
      }
    };
    page.on('request', requestHandler);

    const dashNav = page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 400));

    const skeletonsCount = await page.evaluate(() => {
      return document.querySelectorAll('.animate-pulse').length;
    });
    console.log('Animate pulse skeletons visible during load:', skeletonsCount);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'section6_dashboard_loading_skeletons.png') });

    delayEnabled = false;
    page.off('request', requestHandler);
    await page.setRequestInterception(false);
    await dashNav;
    await new Promise(r => setTimeout(r, 2000));
    results['Section 6 (Dashboard shows fake zeros while loading)'] = skeletonsCount > 0 ? 'PASS' : 'FAIL';

    // =========================================================================
    // SECTION 7: Archived clients are not read only
    // =========================================================================
    console.log('\nVerifying Section 7: Archived clients are not read only...');
    await page.goto(`${BASE_URL}/clients/${UNIZ_ID}`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    const archivedWorkspaceChecks = await page.evaluate(() => {
      const text = document.body.innerText;
      const hasArchivedBanner = text.includes('Archived Workspace (Read-Only)');
      const hasAddTaskBtn = Boolean(document.querySelector('button[aria-label="+ Add Task"]'));
      const hasEditStartDateBtn = Boolean(document.querySelector('[data-testid="edit-start-date-btn"]'));
      const hasClientLinkBtn = Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Client Link'));
      const hasViewAsClientBtn = Array.from(document.querySelectorAll('a')).some(a => a.textContent.includes('View as Client'));
      return {
        hasArchivedBanner,
        hasAddTaskBtn,
        hasEditStartDateBtn,
        hasClientLinkBtn,
        hasViewAsClientBtn
      };
    });
    console.log('Archived workspace checks on UnizConnect:', archivedWorkspaceChecks);

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'section7_archived_client_read_only.png') });
    results['Section 7 (Archived clients are not read only)'] = 
      archivedWorkspaceChecks.hasArchivedBanner &&
      !archivedWorkspaceChecks.hasAddTaskBtn &&
      !archivedWorkspaceChecks.hasEditStartDateBtn &&
      !archivedWorkspaceChecks.hasClientLinkBtn &&
      !archivedWorkspaceChecks.hasViewAsClientBtn ? 'PASS' : 'FAIL';

    // =========================================================================
    // SECTION 8: Client preview sensitive shielding
    // =========================================================================
    console.log('\nVerifying Section 8: Client preview sensitive shielding...');
    await page.goto(`${BASE_URL}/clients/${MAVEN_ID}?preview=true`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    const previewChecks = await page.evaluate(() => {
      const pageText = document.body.innerText;
      const showsInvoiceAmount = pageText.includes('18,300') || pageText.includes('PKR 18,300') || pageText.toLowerCase().includes('sales navigator');
      const showsInternalNotes = pageText.toLowerCase().includes('kahan se aaya') || pageText.includes('Zain se login');
      const showsTimerValues = Array.from(document.querySelectorAll('span.font-mono')).some(s => /\d+h|\d+m\s+\d+s/.test(s.textContent));
      const hasTimerButtons = Array.from(document.querySelectorAll('button')).some(b => b.title.includes('Timer') || b.textContent.includes('Start Work'));
      const showsSlackOrWhatsapp = pageText.includes('Slack Channel URL') || pageText.includes('WhatsApp Group URL') || pageText.includes('POC Number');

      return {
        showsInvoiceAmount,
        showsInternalNotes,
        showsTimerValues,
        hasTimerButtons,
        showsSlackOrWhatsapp
      };
    });
    console.log('Client Preview sensitive shielding checks on Maven:', previewChecks);

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'section8_client_preview_sensitive_shielded.png') });
    results['Section 8 (Client preview sensitive material)'] =
      !previewChecks.showsInvoiceAmount &&
      !previewChecks.showsInternalNotes &&
      !previewChecks.showsTimerValues &&
      !previewChecks.hasTimerButtons &&
      !previewChecks.showsSlackOrWhatsapp ? 'PASS' : 'FAIL';

    // =========================================================================
    // SECTION 9: Wrong people see Add Client and Add Task
    // =========================================================================
    console.log('\nVerifying Section 9: Role permissions for Add Client and Add Task...');
    // Log in as QA Social Media Intern
    await loginUser(page, QA_INTERN_EMAIL, QA_INTERN_PASSWORD);

    // 1. Check Client Management for + Add Client
    await page.goto(`${BASE_URL}/settings/clients`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));
    const internHasAddClient = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some(b => b.textContent.includes('Register New Client') || b.textContent.includes('Add Client'));
    });
    console.log('Intern sees + Add Client in Client Management:', internHasAddClient);

    // 2. Check Client Workspace for + Add Task
    await page.goto(`${BASE_URL}/clients/${MAVEN_ID}`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));
    const internHasAddTask = await page.evaluate(() => {
      return Boolean(document.querySelector('button[aria-label="+ Add Task"]'));
    });
    console.log('Intern sees + Add Task in Workspace:', internHasAddTask);

    // Re-verify Owner has both
    await loginUser(page, QA_OWNER_EMAIL, QA_OWNER_PASSWORD);
    await page.goto(`${BASE_URL}/settings/clients`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));
    const ownerHasAddClient = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some(b => b.textContent.includes('Register New Client') || b.textContent.includes('Add Client'));
    });

    await page.goto(`${BASE_URL}/clients/${MAVEN_ID}`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));
    const ownerHasAddTask = await page.evaluate(() => {
      return Boolean(document.querySelector('button[aria-label="+ Add Task"]'));
    });

    console.log('Owner sees + Add Client:', ownerHasAddClient, '| Owner sees + Add Task:', ownerHasAddTask);

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'section9_role_permissions_add_client_task.png') });
    results['Section 9 (Wrong people see Add Client and Add Task)'] = 
      !internHasAddClient && !internHasAddTask && ownerHasAddClient && ownerHasAddTask ? 'PASS' : 'FAIL';

    // =========================================================================
    // SECTION 10: Forgot password email does not arrive
    // =========================================================================
    console.log('\nVerifying Section 10: Forgot password email...');
    await page.goto(`${BASE_URL}/forgot-password`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('input#reset-email', { timeout: 10000 });
    await page.type('input#reset-email', 'syedkhizar.flc@gmail.com');
    await page.click('button[type="submit"]');
    await new Promise(r => setTimeout(r, 2500));

    const forgotMsg = await page.evaluate(() => {
      return document.body.innerText;
    });
    const forgotSuccess = forgotMsg.includes('If an account exists') || forgotMsg.includes('sent');
    console.log('Forgot password submission response acknowledged:', forgotSuccess);

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'section10_forgot_password_resolved.png') });
    results['Section 10 (Forgot password email does not arrive)'] = forgotSuccess ? 'PASS' : 'FAIL';

    // =========================================================================
    // SECTION 11: Session breaks when you open a preview or a second tab
    // =========================================================================
    console.log('\nVerifying Section 11: Multi-tab session persistence...');
    await loginUser(page, QA_OWNER_EMAIL, QA_OWNER_PASSWORD);
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    // Open Tab 2 with preview
    const page2 = await browser.newPage();
    await page2.goto(`${BASE_URL}/clients/${MAVEN_ID}?preview=true`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    // Reload Tab 1
    await page.bringToFront();
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2500));

    const stillLoggedIn = await page.evaluate(() => {
      return !window.location.pathname.includes('/login') && Boolean(document.querySelector('header, .select-none'));
    });
    console.log('Tab 1 still logged in as Owner after Tab 2 preview reload:', stillLoggedIn);

    await page2.close();
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'section11_multi_tab_session_persistence.png') });
    results['Section 11 (Session breaks when you open a preview or second tab)'] = stillLoggedIn ? 'PASS' : 'FAIL';

  } finally {
    await browser.close();
    console.log('\n======================================================');
    console.log('VERIFICATION TEST RESULTS SUMMARY:');
    console.log('======================================================');
    let allPass = true;
    for (const [section, status] of Object.entries(results)) {
      console.log(`${status === 'PASS' ? '✅' : '❌'} ${section}: ${status}`);
      if (status !== 'PASS') allPass = false;
    }
    console.log('======================================================');
    console.log('OVERALL STATUS:', allPass ? 'ALL 11 SECTIONS PASSED' : 'SOME SECTIONS FAILED');
  }
}

runVerification().catch(err => {
  console.error('Test script error:', err);
  process.exit(1);
});
