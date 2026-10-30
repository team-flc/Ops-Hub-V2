// ==============================================================================
// Verification Suite: My Tasks Kanban vs Workspace Boards Synchronization
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
const FASEEH_LALL_ID = '17441503-5d48-4158-ac6e-b2f07d9c4e5d';

function executeSql(sql) {
  const tmpFile = path.join(__dirname, `tmp_verify_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.sql`);
  fs.writeFileSync(tmpFile, sql, 'utf-8');
  try {
    return execSync(`npx.cmd supabase db query --linked -f "${tmpFile}"`, {
      cwd: 'C:\\Users\\Atif\\Documents\\GitHub\\Ops-Hub-V2',
      encoding: 'utf-8'
    });
  } finally {
    if (fs.existsSync(tmpFile)) {
      try { fs.unlinkSync(tmpFile); } catch (e) {}
    }
  }
}

function setupQaUser() {
  console.log('Ensuring disposable QA Owner in linked Supabase database...');
  const sql = `
    DO $$
    DECLARE
      u_id UUID := '${QA_OWNER_ID}';
      u_email TEXT := '${QA_OWNER_EMAIL}';
      u_pass TEXT := '${QA_OWNER_PASSWORD}';
      v_user_exists BOOLEAN := FALSE;
    BEGIN
      DELETE FROM public.user_2fa_recovery_codes WHERE user_id = u_id;
      DELETE FROM public.user_2fa_attempts WHERE user_id = u_id;
      DELETE FROM auth.mfa_challenges WHERE factor_id IN (SELECT id FROM auth.mfa_factors WHERE user_id = u_id);
      DELETE FROM auth.mfa_factors WHERE user_id = u_id;

      SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = u_id) INTO v_user_exists;

      IF v_user_exists THEN
        UPDATE auth.users
        SET encrypted_password = crypt(u_pass, gen_salt('bf')),
            banned_until = NULL,
            updated_at = NOW()
        WHERE id = u_id;
      ELSE
        INSERT INTO auth.users (
          id, instance_id, aud, role, email, encrypted_password,
          email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
          confirmation_token, recovery_token, email_change_token_new, email_change,
          phone_change, phone_change_token, reauthentication_token,
          created_at, updated_at
        ) VALUES (
          u_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          u_email, crypt(u_pass, gen_salt('bf')),
          NOW(), '{"provider":"email","providers":["email"]}'::jsonb,
          '{"full_name":"QA Owner"}'::jsonb,
          '', '', '', '',
          '', '', '',
          NOW(), NOW()
        );

        INSERT INTO auth.identities (
          id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), u_id,
          json_build_object('sub', u_id::text, 'email', u_email, 'email_verified', true, 'phone_verified', false)::jsonb,
          'email', u_id::text, NOW(), NOW(), NOW()
        );
      END IF;

      INSERT INTO public.profiles (
        id, full_name, role, status, contact_email, work_email, created_at, updated_at
      ) VALUES (
        u_id, 'QA Owner', 'owner', 'active', u_email, u_email, NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE
      SET full_name = 'QA Owner',
          role = 'owner',
          status = 'active',
          contact_email = u_email,
          work_email = u_email,
          updated_at = NOW();
    END;
    $$;
  `;
  executeSql(sql);
  console.log('[OK] QA Owner configured.');
}

function cleanupQaUser() {
  console.log('Cleaning up QA user session state...');
  const sql = `
    DO $$
    DECLARE
      u_id UUID := '${QA_OWNER_ID}';
    BEGIN
      DELETE FROM public.user_2fa_recovery_codes WHERE user_id = u_id;
      DELETE FROM public.user_2fa_attempts WHERE user_id = u_id;
      DELETE FROM auth.mfa_challenges WHERE factor_id IN (SELECT id FROM auth.mfa_factors WHERE user_id = u_id);
      DELETE FROM auth.mfa_factors WHERE user_id = u_id;
      UPDATE public.profiles SET status = 'inactive' WHERE id = u_id;
      UPDATE auth.users SET banned_until = NOW() + INTERVAL '100 years' WHERE id = u_id;
    END;
    $$;
  `;
  try {
    executeSql(sql);
    console.log('[OK] QA user disabled.');
  } catch (e) {
    console.warn('Notice:', e.message);
  }
}

async function selectWeek(page, weekNum) {
  await page.waitForSelector(`[data-testid="week-step-${weekNum}"]`, { timeout: 10000 });
  await page.evaluate((wn) => {
    const step = document.querySelector(`[data-testid="week-step-${wn}"]`);
    if (step) {
      const btn = step.querySelector('button');
      if (btn) btn.click();
      else step.click();
    }
  }, weekNum);
  await new Promise(r => setTimeout(r, 2000));
}

async function getBoardTasks(page) {
  return await page.evaluate(() => {
    const tasks = [];
    document.querySelectorAll('[data-testid^="kanban-card-"]').forEach(card => {
      const title = card.querySelector('h4')?.innerText?.trim();
      const text = card.innerText;
      const colEl = card.closest('[data-testid^="kanban-column-"]');
      const colTitle = colEl?.querySelector('h3')?.innerText?.trim() || colEl?.getAttribute('data-testid')?.replace('kanban-column-', '');
      tasks.push({
        title,
        hasWorkCompleted: text.includes('Work Completed'),
        columnTitle: colTitle,
        cardText: text.replace(/\n+/g, ' | ')
      });
    });
    return tasks;
  });
}

async function run() {
  setupQaUser();

  console.log('\nLaunching Chrome browser for visual & DOM verification...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1440, height: 1100 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    // 1. Log in as QA Owner
    console.log('Logging in as QA Owner...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('#work-email');
    await page.type('#work-email', QA_OWNER_EMAIL);
    await page.type('#password', QA_OWNER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    console.log('[OK] Logged in successfully.');

    // 2. Set test override in localStorage so My Tasks scopes to Faseeh Lall's tasks
    console.log('Setting test user override to Faseeh Lall...');
    await page.evaluate((faseehId) => {
      localStorage.setItem('opshub_test_user_id', faseehId);
    }, FASEEH_LALL_ID);

    // 3. Open Dashboard
    console.log('\nNavigating to Dashboard (/)...');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => {
      return document.body.innerText.includes('Cross-Client Operations Kanban');
    }, { timeout: 25000 });

    await new Promise(r => setTimeout(r, 2000));

    // Scroll to Kanban
    await page.evaluate(() => {
      const kanban = Array.from(document.querySelectorAll('h2')).find(h => h.innerText.includes('Cross-Client Operations Kanban'));
      if (kanban) kanban.scrollIntoView({ behavior: 'instant', block: 'center' });
    });
    await new Promise(r => setTimeout(r, 1000));

    // Capture screenshot of My Tasks Kanban
    const myTasksShot = path.join(ARTIFACTS_DIR, 'verify_mytasks_1_kanban.png');
    await page.screenshot({ path: myTasksShot, fullPage: false });
    console.log(`[OK] Screenshot saved: ${myTasksShot}`);

    // Extract all cards and columns in My Tasks
    const myTasksData = await page.evaluate(() => {
      const columns = [];
      const cols = document.querySelectorAll('[class*="grid-cols-1 md:grid-cols-2 xl:grid-cols-4"] > div');
      cols.forEach(col => {
        const header = col.querySelector('span[class*="tracking-wider"]')?.innerText?.trim();
        const badge = col.querySelector('span[class*="rounded-full"]')?.innerText?.trim();
        const cards = [];
        col.querySelectorAll('h4').forEach(h4 => {
          const cardEl = h4.closest('.p-3\\.5, [class*="rounded-2xl"]');
          const title = h4.innerText.trim();
          const cardText = cardEl ? cardEl.innerText : '';
          const hasWorkCompleted = cardText.includes('Work Completed');
          const hasResumeButton = cardText.includes('Resume');
          const hasStartButton = cardText.includes('Start');
          const statusBadge = cardEl?.querySelector('[data-testid^="task-status-badge"]')?.innerText?.trim() || null;
          cards.push({
            title,
            statusBadge,
            hasWorkCompleted,
            hasResumeButton,
            hasStartButton,
            textSnippet: cardText.replace(/\n+/g, ' | ')
          });
        });
        columns.push({ header, count: badge, cards });
      });
      return columns;
    });

    console.log('\n--- MY TASKS KANBAN BREAKDOWN ---');
    myTasksData.forEach(col => {
      console.log(`Column [${col.header}]: ${col.count} tasks`);
      col.cards.forEach(c => {
        console.log(`  - "${c.title}" | StatusBadge: ${c.statusBadge} | WorkCompleted: ${c.hasWorkCompleted} | ResumeBtn: ${c.hasResumeButton}`);
      });
    });

    // --------------------------------------------------------------------------
    // CHECK 1 & 2: Pixel Algos Workspace (Week 3 Funnel Setup)
    // --------------------------------------------------------------------------
    console.log('\n--- CHECK 1 & 2: Navigating to Pixel Algos Workspace ---');
    const pixelAlgosUrl = `${BASE_URL}/clients/5b9ea614-9b21-4b26-9c17-a8fa98b451c8`;
    await page.goto(pixelAlgosUrl, { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => document.body.innerText.includes('Pixel Algos') || document.body.innerText.includes('Funnel Setup'), { timeout: 20000 });
    await new Promise(r => setTimeout(r, 1500));

    // Ensure Week 3 is selected
    console.log('Selecting Week 3 on Pixel Algos...');
    await selectWeek(page, 3);

    const pixelShot = path.join(ARTIFACTS_DIR, 'verify_mytasks_2_pixel_algos_workspace.png');
    await page.screenshot({ path: pixelShot, fullPage: false });
    console.log(`[OK] Screenshot saved: ${pixelShot}`);

    const pixelTasks = await getBoardTasks(page);
    console.log(`Found ${pixelTasks.length} tasks on Pixel Algos board:`);
    pixelTasks.forEach(t => console.log(`  - "${t.title}" in column: ${t.columnTitle} | WorkCompleted: ${t.hasWorkCompleted}`));

    // --------------------------------------------------------------------------
    // CHECK 3: Maven Professionals Workspace (Week 3 Funnel Setup)
    // --------------------------------------------------------------------------
    console.log('\n--- CHECK 3: Navigating to Maven Professionals Workspace ---');
    const mavenUrl = `${BASE_URL}/clients/8e5d17bf-1ba9-41e1-9ef7-09ca137a72d3`;
    await page.goto(mavenUrl, { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => document.body.innerText.includes('Maven Professionals') || document.body.innerText.includes('Funnel Setup'), { timeout: 20000 });
    await new Promise(r => setTimeout(r, 1500));

    // Ensure Week 3 is selected
    console.log('Selecting Week 3 on Maven Professionals...');
    await selectWeek(page, 3);

    const mavenShot = path.join(ARTIFACTS_DIR, 'verify_mytasks_3_maven_workspace.png');
    await page.screenshot({ path: mavenShot, fullPage: false });
    console.log(`[OK] Screenshot saved: ${mavenShot}`);

    const mavenTasks = await getBoardTasks(page);
    console.log(`Found ${mavenTasks.length} tasks on Maven Professionals board:`);
    mavenTasks.forEach(t => console.log(`  - "${t.title}" in column: ${t.columnTitle} | WorkCompleted: ${t.hasWorkCompleted}`));

    // --------------------------------------------------------------------------
    // CHECK 4: Sample check 3 other tasks:
    // 1. Penta Cipher VSL Script (Penta Cipher, Week 3) -> Expected: Pending
    // 2. Wise 360 VSL Script (Wise 360, Week 2) -> Expected: Pending
    // 3. Script Writing (Pixel Algos, Week 3) -> Expected: Approval
    // --------------------------------------------------------------------------
    console.log('\n--- CHECK 4: Navigating to Penta Cipher Workspace ---');
    const pentaUrl = `${BASE_URL}/clients/59010ecc-4249-4e49-8ddb-628f9651e0d2`;
    await page.goto(pentaUrl, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));
    console.log('Selecting Week 3 on Penta Cipher...');
    await selectWeek(page, 3);

    const pentaShot = path.join(ARTIFACTS_DIR, 'verify_mytasks_4_penta_cipher_workspace.png');
    await page.screenshot({ path: pentaShot, fullPage: false });
    console.log(`[OK] Screenshot saved: ${pentaShot}`);
    const pentaTasks = await getBoardTasks(page);
    console.log(`Found ${pentaTasks.length} tasks on Penta Cipher board:`);
    pentaTasks.forEach(t => console.log(`  - "${t.title}" in column: ${t.columnTitle}`));

    console.log('\n--- CHECK 5: Navigating to Wise 360 Workspace ---');
    const wiseUrl = `${BASE_URL}/clients/a96d9ab6-fc7a-4648-8b93-ec818f9290a2`;
    await page.goto(wiseUrl, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));
    console.log('Selecting Week 2 on Wise 360...');
    await selectWeek(page, 2);

    const wiseShot = path.join(ARTIFACTS_DIR, 'verify_mytasks_5_wise360_workspace.png');
    await page.screenshot({ path: wiseShot, fullPage: false });
    console.log(`[OK] Screenshot saved: ${wiseShot}`);
    const wiseTasks = await getBoardTasks(page);
    console.log(`Found ${wiseTasks.length} tasks on Wise 360 board:`);
    wiseTasks.forEach(t => console.log(`  - "${t.title}" in column: ${t.columnTitle}`));

    // --------------------------------------------------------------------------
    // SUMMARY OF COMPARISONS
    // --------------------------------------------------------------------------
    console.log('\n======================================================');
    console.log('--- RECONCILIATION & COMPARISON SUMMARY ---');
    console.log('======================================================');

    // 1. Pixel Algos VSL Script
    const myPixelTask = myTasksData.flatMap(col => col.cards.map(c => ({ ...c, column: col.header }))).find(c => c.title === 'Pixel Algos VSL Script');
    const boardPixelTask = pixelTasks.find(t => t.title === 'Pixel Algos VSL Script');
    const pixelMatches = myPixelTask?.statusBadge === 'Approval' && boardPixelTask?.columnTitle === 'Approval' && myPixelTask?.hasWorkCompleted === true && myPixelTask?.hasResumeButton === false;
    console.log(`1. Task: "Pixel Algos VSL Script"`);
    console.log(`   - My Tasks Status:        ${myPixelTask?.statusBadge} (Column: ${myPixelTask?.column}, Work Completed: ${myPixelTask?.hasWorkCompleted}, ResumeBtn: ${myPixelTask?.hasResumeButton})`);
    console.log(`   - Workspace Board Status: ${boardPixelTask ? 'Found' : 'Not found'} (Column: ${boardPixelTask?.columnTitle}, Work Completed: ${boardPixelTask?.hasWorkCompleted})`);
    console.log(`   - Match:                  ${pixelMatches ? 'PASS' : 'FAIL'}`);

    // 2. Maven Professional VSL Script
    const myMavenTask = myTasksData.flatMap(col => col.cards.map(c => ({ ...c, column: col.header }))).find(c => c.title === 'Maven Professional VSL Script');
    const boardMavenTask = mavenTasks.find(t => t.title === 'Maven Professional VSL Script');
    const mavenMatches = myMavenTask?.statusBadge === 'Approval' && boardMavenTask?.columnTitle === 'Approval' && myMavenTask?.hasWorkCompleted === true && myMavenTask?.hasResumeButton === false;
    console.log(`2. Task: "Maven Professional VSL Script"`);
    console.log(`   - My Tasks Status:        ${myMavenTask?.statusBadge} (Column: ${myMavenTask?.column}, Work Completed: ${myMavenTask?.hasWorkCompleted}, ResumeBtn: ${myMavenTask?.hasResumeButton})`);
    console.log(`   - Workspace Board Status: ${boardMavenTask ? 'Found' : 'Not found'} (Column: ${boardMavenTask?.columnTitle}, Work Completed: ${boardMavenTask?.hasWorkCompleted})`);
    console.log(`   - Match:                  ${mavenMatches ? 'PASS' : 'FAIL'}`);

    // 3. Penta Cipher VSL Script
    const myPentaTask = myTasksData.flatMap(col => col.cards.map(c => ({ ...c, column: col.header }))).find(c => c.title === 'Penta Cipher VSL Script');
    const boardPentaTask = pentaTasks.find(t => t.title === 'Penta Cipher VSL Script');
    const pentaMatches = myPentaTask?.statusBadge === 'Pending' && boardPentaTask?.columnTitle === 'Pending';
    console.log(`3. Sample Task 1: "Penta Cipher VSL Script"`);
    console.log(`   - My Tasks:               ${myPentaTask?.statusBadge} (Column: ${myPentaTask?.column})`);
    console.log(`   - Workspace Board Status: ${boardPentaTask ? 'Found' : 'Not found'} (Column: ${boardPentaTask?.columnTitle})`);
    console.log(`   - Match:                  ${pentaMatches ? 'PASS' : 'FAIL'}`);

    // 4. Wise 360 VSL Script
    const myWiseTask = myTasksData.flatMap(col => col.cards.map(c => ({ ...c, column: col.header }))).find(c => c.title === 'Wise 360 VSL Script');
    const boardWiseTask = wiseTasks.find(t => t.title === 'Wise 360 VSL Script');
    const wiseMatches = myWiseTask?.statusBadge === 'Pending' && boardWiseTask?.columnTitle === 'Pending';
    console.log(`4. Sample Task 2: "Wise 360 VSL Script"`);
    console.log(`   - My Tasks:               ${myWiseTask?.statusBadge} (Column: ${myWiseTask?.column})`);
    console.log(`   - Workspace Board Status: ${boardWiseTask ? 'Found' : 'Not found'} (Column: ${boardWiseTask?.columnTitle})`);
    console.log(`   - Match:                  ${wiseMatches ? 'PASS' : 'FAIL'}`);

    // 5. Script Writing
    const myScriptTask = myTasksData.flatMap(col => col.cards.map(c => ({ ...c, column: col.header }))).find(c => c.title === 'Script Writing');
    const boardScriptTask = pixelTasks.find(t => t.title === 'Script Writing');
    const scriptMatches = myScriptTask?.statusBadge === 'Approval' && boardScriptTask?.columnTitle === 'Approval' && myScriptTask?.hasWorkCompleted === true;
    console.log(`5. Sample Task 3: "Script Writing"`);
    console.log(`   - My Tasks:               ${myScriptTask?.statusBadge} (Column: ${myScriptTask?.column}, Work Completed: ${myScriptTask?.hasWorkCompleted})`);
    console.log(`   - Workspace Board:        ${boardScriptTask ? 'Found' : 'Not found'} (Column: ${boardScriptTask?.columnTitle}, Work Completed: ${boardScriptTask?.hasWorkCompleted})`);
    console.log(`   - Match:                  ${scriptMatches ? 'PASS' : 'FAIL'}`);

    console.log('======================================================');
    if (pixelMatches && mavenMatches && pentaMatches && wiseMatches && scriptMatches) {
      console.log('[PASS] ALL 5 TASKS SYNCHRONIZED AND MATCHING WORKSPACE BOARDS IDENTICALLY');
    } else {
      console.error('[FAIL] ONE OR MORE TASKS MISMATCHED');
      process.exitCode = 1;
    }

  } catch (err) {
    console.error('Verification failed:', err);
    throw err;
  } finally {
    cleanupQaUser();
    await browser.close();
  }
}

run();
