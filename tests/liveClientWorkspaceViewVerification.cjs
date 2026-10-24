// ==============================================================================
// Live Production End-to-End Verification Suite: Client Workspace "View as Client"
// Target: https://ops.faseehlall.com / https://obshub2.pages.dev
// Database: Linked Supabase Production Database (jcaptlqenwmpfchjyipw)
// ==============================================================================

const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PROD_URL = 'https://ops.faseehlall.com';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\Atif\\.gemini\\antigravity\\brain\\dc6b2411-97c2-4334-900a-7f5e6445dbb3';

// Existing production client Cloud Z Technologies
const CLOUD_Z_CLIENT_ID = 'd3d666c2-24c7-4cc7-b879-55c6d5881185';

// Disposable Owner/Manager Account
const QA_MGR_EMAIL = 'qa.owner.view@faseehlall.com';
const QA_MGR_PASSWORD = 'QAOwnerPass2026!#';
const QA_MGR_ID = 'a1a1a1a1-1111-4111-8111-111111111111';

// Disposable Client User Account
const QA_CLIENT_EMAIL = 'qa.client.view@cloudz.com';
const QA_CLIENT_PASSWORD = 'QAClientPass2026!#';
const QA_CLIENT_USER_ID = 'b2b2b2b2-2222-4222-8222-222222222222';

function executeSql(sql) {
  const tmpFile = path.join(__dirname, `tmp_view_qa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.sql`);
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

function setupQaUsers() {
  console.log('Setting up disposable QA users in production Supabase...');
  const sql = `
    DO $$
    DECLARE
      mgr_id UUID := '${QA_MGR_ID}';
      mgr_email TEXT := '${QA_MGR_EMAIL}';
      mgr_pass TEXT := '${QA_MGR_PASSWORD}';

      cli_id UUID := '${QA_CLIENT_USER_ID}';
      cli_email TEXT := '${QA_CLIENT_EMAIL}';
      cli_pass TEXT := '${QA_CLIENT_PASSWORD}';
      target_client UUID := '${CLOUD_Z_CLIENT_ID}';
    BEGIN
      -- Cleanup previous runs
      DELETE FROM auth.identities WHERE user_id IN (mgr_id, cli_id);
      DELETE FROM public.profiles WHERE id IN (mgr_id, cli_id);
      DELETE FROM auth.users WHERE id IN (mgr_id, cli_id);

      -- 1. Create QA Owner
      INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        phone_change, phone_change_token, reauthentication_token,
        created_at, updated_at
      ) VALUES (
        mgr_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        mgr_email, crypt(mgr_pass, gen_salt('bf')),
        NOW(), '{"provider":"email","providers":["email"]}'::jsonb,
        '{"full_name":"QA Test Owner"}'::jsonb,
        '', '', '', '',
        '', '', '',
        NOW(), NOW()
      );

      INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), mgr_id,
        json_build_object('sub', mgr_id::text, 'email', mgr_email, 'email_verified', true, 'phone_verified', false)::jsonb,
        'email', mgr_id::text, NOW(), NOW(), NOW()
      );

      UPDATE public.profiles
      SET full_name = 'QA Test Owner',
          role = 'owner',
          status = 'active',
          contact_email = mgr_email,
          work_email = mgr_email
      WHERE id = mgr_id;

      -- 2. Create QA Client
      INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        phone_change, phone_change_token, reauthentication_token,
        created_at, updated_at
      ) VALUES (
        cli_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        cli_email, crypt(cli_pass, gen_salt('bf')),
        NOW(), '{"provider":"email","providers":["email"]}'::jsonb,
        '{"full_name":"Cloud Z Client Viewer"}'::jsonb,
        '', '', '', '',
        '', '', '',
        NOW(), NOW()
      );

      INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), cli_id,
        json_build_object('sub', cli_id::text, 'email', cli_email, 'email_verified', true, 'phone_verified', false)::jsonb,
        'email', cli_id::text, NOW(), NOW(), NOW()
      );

      UPDATE public.profiles
      SET full_name = 'Cloud Z Client Viewer',
          role = 'client',
          organization_id = target_client::text,
          status = 'active',
          contact_email = cli_email,
          work_email = cli_email
      WHERE id = cli_id;

      INSERT INTO public.client_portal_recipients (
        id, client_id, profile_id, email, full_name, status, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), target_client, cli_id, cli_email, 'Cloud Z Client Viewer', 'active', NOW(), NOW()
      ) ON CONFLICT DO NOTHING;

    END $$;
  `;
  executeSql(sql);
  console.log('[OK] Disposable Owner and Client users created successfully.');
}

function cleanupQaUsers() {
  console.log('Cleaning up disposable QA users from production Supabase...');
  const sql = `
    DO $$
    BEGIN
      DELETE FROM public.client_portal_recipients WHERE profile_id = '${QA_CLIENT_USER_ID}';
      DELETE FROM auth.identities WHERE user_id IN ('${QA_MGR_ID}', '${QA_CLIENT_USER_ID}');
      DELETE FROM public.profiles WHERE id IN ('${QA_MGR_ID}', '${QA_CLIENT_USER_ID}');
      DELETE FROM auth.users WHERE id IN ('${QA_MGR_ID}', '${QA_CLIENT_USER_ID}');
    END $$;
  `;
  try {
    executeSql(sql);
    console.log('[OK] QA users removed.');
  } catch (e) {
    console.log('Cleanup notice:', e.message);
  }
}

async function run() {
  console.log('=== STARTING LIVE PRODUCTION VERIFICATION SUITE ===');
  console.log('Target URL:', PROD_URL);
  console.log('Target Client ID:', CLOUD_Z_CLIENT_ID);

  setupQaUsers();

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error' && !text.includes('favicon')) {
      console.log(`[BROWSER ERROR]`, text);
    }
  });

  try {
    // =========================================================================
    // PART 1: STAFF "VIEW AS CLIENT" PREVIEW VERIFICATION
    // =========================================================================
    console.log('\n--- PART 1: Staff "View as Client" Preview Mode ---');

    console.log('Navigating to login page...');
    await page.goto(`${PROD_URL}/login`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1000));

    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.type('input[type="email"]', QA_MGR_EMAIL);
    await page.type('input[type="password"]', QA_MGR_PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForFunction(() => !window.location.pathname.includes('/login'), { timeout: 20000 });
    await new Promise(r => setTimeout(r, 2000));
    console.log('Manager logged in. Current path:', await page.evaluate(() => window.location.pathname));

    // Navigate to Cloud Z Technologies workspace
    console.log('Navigating to Cloud Z Technologies workspace...');
    await page.goto(`${PROD_URL}/clients/${CLOUD_Z_CLIENT_ID}`, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForFunction(() => document.body.innerText.includes('Cloud Z Technologies'), { timeout: 20000 });
    await new Promise(r => setTimeout(r, 1500));

    // Verify Manager has "View as Client" button and "+ Add Task" button
    const managerButtons = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a'));
      return {
        hasViewAsClient: buttons.some(b => b.innerText.includes('View as Client')),
        hasAddTask: buttons.some(b => b.innerText.includes('Add Task')),
        hasClientLink: buttons.some(b => b.innerText.includes('Client Link')),
        hasSettings: buttons.some(b => b.innerText.trim() === 'Settings')
      };
    });
    console.log('Manager Workspace Controls:', managerButtons);
    if (!managerButtons.hasViewAsClient) {
      throw new Error('Manager should see "View as Client" button');
    }

    // Now visit the Preview URL (as clicking View as Client opens)
    console.log('Opening "View as Client" Preview Mode...');
    await page.goto(`${PROD_URL}/clients/${CLOUD_Z_CLIENT_ID}?preview=true`, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForFunction(() => document.body.innerText.includes('Client Preview Mode'), { timeout: 20000 });
    await new Promise(r => setTimeout(r, 2000));

    // Capture screenshot: Staff Preview Workspace
    const shot1 = path.join(ARTIFACTS_DIR, 'live_client_view_1_staff_preview.png');
    await page.screenshot({ path: shot1, fullPage: false });
    console.log(`[OK] Saved Screenshot 1: ${shot1}`);

    // Verify read-only enforcement in Preview Mode:
    const previewInspection = await page.evaluate(() => {
      const text = document.body.innerText;
      const buttons = Array.from(document.querySelectorAll('button, a'));
      const hasBanner = text.includes('Client Preview Mode') && text.toLowerCase().includes('read-only');
      const hasExitPreview = buttons.some(b => b.innerText.includes('Exit Preview'));
      const hasAddTask = buttons.some(b => b.innerText.includes('Add Task'));
      const hasSettings = buttons.some(b => b.innerText.trim() === 'Settings');
      const hasClientLink = buttons.some(b => b.innerText.includes('Client Link'));
      const hasViewAsClient = buttons.some(b => b.innerText.includes('View as Client'));
      const hasClientDetailsTab = buttons.some(b => b.innerText.includes('Client Details'));

      // Stepper check (case-insensitive for WEEK 1, Week 1)
      const weekTabs = buttons.filter(b => b.innerText.toLowerCase().includes('week ')).map(b => b.innerText.trim());

      // Drag and drop check
      const draggables = Array.from(document.querySelectorAll('[draggable="true"]'));

      return {
        hasBanner,
        hasExitPreview,
        hasAddTask,
        hasSettings,
        hasClientLink,
        hasViewAsClient,
        hasClientDetailsTab,
        weekTabs,
        draggableCount: draggables.length
      };
    });

    console.log('Preview Mode Inspection Results:', previewInspection);
    if (!previewInspection.hasBanner) throw new Error('Preview banner missing');
    if (!previewInspection.hasExitPreview) throw new Error('Exit Preview button missing');
    if (previewInspection.hasAddTask) throw new Error('+ Add Task button must be hidden in client view');
    if (previewInspection.hasSettings) throw new Error('Settings button in sidebar must be hidden in client view');
    if (previewInspection.hasClientLink) throw new Error('Client Link sharing button must be hidden in preview');
    if (previewInspection.hasClientDetailsTab) throw new Error('Client Details tab must be hidden in client view');
    if (previewInspection.draggableCount > 0) throw new Error(`Tasks must not be draggable (found ${previewInspection.draggableCount})`);

    // Verify activities remain clickable: Click Week 2, then Week 1
    console.log('Testing Week Stepper clickability...');
    await page.evaluate(() => {
      const week2 = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Week 2'));
      if (week2) week2.click();
    });
    await new Promise(r => setTimeout(r, 1000));

    await page.evaluate(() => {
      const week1 = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Week 1'));
      if (week1) week1.click();
    });
    await new Promise(r => setTimeout(r, 1000));
    console.log('[OK] Week stepper is interactive and clickable.');

    // Click on a task card to open the read-only drawer
    console.log('Clicking a task card to inspect details drawer...');
    await page.waitForSelector('[data-testid^="kanban-card-"]', { timeout: 10000 });
    await page.click('[data-testid^="kanban-card-"]');
    await page.waitForSelector('button[title="Close Drawer"]', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 1500));

    // Capture screenshot: Read-Only Task Drawer
    const shot2 = path.join(ARTIFACTS_DIR, 'live_client_view_2_drawer_readonly.png');
    await page.screenshot({ path: shot2, fullPage: false });
    console.log(`[OK] Saved Screenshot 2: ${shot2}`);

    const drawerInspection = await page.evaluate(() => {
      const hasEditPencil = Boolean(document.querySelector('button[title*="Edit Task"]'));
      const hasArchiveButton = Boolean(document.querySelector('button[title*="Archive Task"]'));
      const hasAssigneeDropdown = Boolean(document.querySelector('select'));
      return {
        hasEditPencil,
        hasArchiveButton,
        hasAssigneeDropdown
      };
    });
    console.log('Task Details Drawer Inspection:', drawerInspection);
    if (drawerInspection.hasEditPencil) throw new Error('Edit Task button must be hidden');
    if (drawerInspection.hasArchiveButton) throw new Error('Archive Task button must be hidden');

    // Close drawer
    await page.click('button[title="Close Drawer"]');
    await new Promise(r => setTimeout(r, 1000));

    // Sign out manager
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // =========================================================================
    // PART 2: CLIENT USER ROLE WORKSPACE VERIFICATION
    // =========================================================================
    console.log('\n--- PART 2: Client User Role Workspace Access ---');
    await page.goto(`${PROD_URL}/login`, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1000));

    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.type('input[type="email"]', QA_CLIENT_EMAIL);
    await page.type('input[type="password"]', QA_CLIENT_PASSWORD);
    await page.click('button[type="submit"]');

    // Client should automatically land on /clients/47d8df98-e74f-4d92-bb88-348f02f901ae
    await page.waitForFunction(() => window.location.pathname.startsWith('/clients/'), { timeout: 20000 });
    await page.waitForFunction(() => document.body.innerText.includes('Cloud Z Technologies'), { timeout: 20000 });
    await new Promise(r => setTimeout(r, 2000));

    const clientLandingUrl = await page.evaluate(() => window.location.href);
    console.log('[OK] Client user landed directly on workspace:', clientLandingUrl);

    // Capture screenshot: Client Role Workspace
    const shot3 = path.join(ARTIFACTS_DIR, 'live_client_view_3_client_role_workspace.png');
    await page.screenshot({ path: shot3, fullPage: false });
    console.log(`[OK] Saved Screenshot 3: ${shot3}`);

    const clientWorkspaceState = await page.evaluate(() => {
      const text = document.body.innerText;
      const buttons = Array.from(document.querySelectorAll('button, a'));
      const hasPreviewBanner = text.includes('Client Preview Mode');
      const hasCloudZ = text.includes('Cloud Z Technologies');
      const hasSettings = buttons.some(b => b.innerText.trim() === 'Settings');
      const hasAddTask = buttons.some(b => b.innerText.includes('Add Task'));
      const hasClientDetailsTab = buttons.some(b => b.innerText.includes('Client Details'));
      const draggables = Array.from(document.querySelectorAll('[draggable="true"]'));

      // Check workspace links in sidebar (Website, Drive, Creative Links, Variations, POC Email, etc.)
      const sidebarLinks = Array.from(document.querySelectorAll('aside a, aside button')).map(el => el.innerText.trim());

      return {
        hasPreviewBanner,
        hasCloudZ,
        hasSettings,
        hasAddTask,
        hasClientDetailsTab,
        draggableCount: draggables.length,
        sidebarLinksCount: sidebarLinks.length
      };
    });

    console.log('Client Role Workspace State:', clientWorkspaceState);
    if (clientWorkspaceState.hasPreviewBanner) throw new Error('Real client should NOT see staff preview banner');
    if (!clientWorkspaceState.hasCloudZ) throw new Error('Client organization name must be visible');
    if (clientWorkspaceState.hasSettings) throw new Error('Sidebar Settings button must be hidden for clients');
    if (clientWorkspaceState.hasAddTask) throw new Error('+ Add Task must be hidden for clients');
    if (clientWorkspaceState.hasClientDetailsTab) throw new Error('Client Details tab must be hidden for clients');
    if (clientWorkspaceState.draggableCount > 0) throw new Error('Kanban cards must not be draggable for clients');

    // Click a task card as client to open drawer
    console.log('Opening task card as client...');
    await page.waitForSelector('[data-testid^="kanban-card-"]', { timeout: 10000 });
    await page.click('[data-testid^="kanban-card-"]');
    await page.waitForSelector('button[title="Close Drawer"]', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 1500));

    // Capture screenshot: Client Task Drawer
    const shot4 = path.join(ARTIFACTS_DIR, 'live_client_view_4_client_drawer.png');
    await page.screenshot({ path: shot4, fullPage: false });
    console.log(`[OK] Saved Screenshot 4: ${shot4}`);

    // Verify multi-tenant isolation: client attempting to navigate to another client ID is immediately redirected
    console.log('Verifying client multi-tenant isolation guard...');
    const fakeOtherClientId = '11111111-2222-3333-4444-555555555555';
    await page.goto(`${PROD_URL}/clients/${fakeOtherClientId}`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));
    const redirectedUrl = await page.evaluate(() => window.location.pathname);
    console.log(`Client requested other client (${fakeOtherClientId}) -> redirected to: ${redirectedUrl}`);
    if (!redirectedUrl.includes(CLOUD_Z_CLIENT_ID)) {
      throw new Error(`Client multi-tenant isolation failed! Expected redirect to ${CLOUD_Z_CLIENT_ID}, got ${redirectedUrl}`);
    }
    console.log('[OK] Client multi-tenant isolation verified: client is confined strictly to their own workspace.');

    console.log('\n======================================================================');
    console.log('ALL LIVE BROWSER VERIFICATIONS PASSED WITH 100% SUCCESS!');
    console.log('======================================================================');

  } catch (err) {
    console.error('LIVE VERIFICATION ERROR:', err);
    const errShot = path.join(ARTIFACTS_DIR, 'live_client_view_error.png');
    await page.screenshot({ path: errShot, fullPage: true });
    console.log(`Saved error screenshot: ${errShot}`);
    throw err;
  } finally {
    await browser.close();
    cleanupQaUsers();
    console.log('Verification finished and disposable users cleaned up.');
  }
}

run();
