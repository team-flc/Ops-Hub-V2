// ==============================================================================
// Verification Script: Awaiting Approval Count Reconciliation
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

function executeSql(sql) {
  const tmpFile = path.join(__dirname, `tmp_appr_qa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.sql`);
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

async function verifyApprovalNumbers() {
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
    console.log('Logging in as Owner...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('#work-email');
    await page.type('#work-email', QA_OWNER_EMAIL);
    await page.type('#password', QA_OWNER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    console.log('[OK] Logged in successfully.');

    // 2. Open Dashboard
    console.log('\nNavigating to Dashboard (/)...');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => {
      return document.body.innerText.includes('Company Approvals Queue') &&
             document.body.innerText.includes('Awaiting Approval');
    }, { timeout: 25000 });

    await new Promise(r => setTimeout(r, 3000));

    // Screenshot 1: Dashboard Top
    const shotPath1 = path.join(ARTIFACTS_DIR, 'verify_approval_1_stat_card_and_queue.png');
    await page.screenshot({ path: shotPath1, fullPage: false });
    console.log(`[OK] Screenshot saved: ${shotPath1}`);

    // Read numbers from Dashboard top
    const topData = await page.evaluate(() => {
      let statCardNumber = null;
      for (const card of document.querySelectorAll('div')) {
        const text = card.innerText || '';
        if (text.includes('AWAITING APPROVAL') && text.includes('Submitted for management review')) {
          const match = text.match(/AWAITING APPROVAL\s+(\d+)/i) || text.match(/(\d+)\s+Submitted for management review/i);
          if (match) {
            statCardNumber = parseInt(match[1], 10);
            break;
          }
        }
      }

      let queueNumber = null;
      for (const el of document.querySelectorAll('*')) {
        const t = (el.innerText || '').trim();
        const match = t.match(/^(\d+)\s+Pending$/i);
        if (match) {
          queueNumber = parseInt(match[1], 10);
          break;
        }
      }

      return { statCardNumber, queueNumber };
    });

    // 3. Switch Kanban to "All Company Tasks"
    console.log('Switching Kanban to "All Company Tasks"...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const allCompanyBtn = btns.find(b => (b.textContent || '').trim() === 'All Company Tasks');
      if (allCompanyBtn) {
        allCompanyBtn.click();
      }
    });
    await new Promise(r => setTimeout(r, 2000));

    // Scroll main to Kanban view
    await page.evaluate(() => {
      const main = document.querySelector('main');
      if (main) {
        const h2 = Array.from(main.querySelectorAll('h2')).find(el => (el.textContent || '').includes('Cross-Client Operations Kanban'));
        if (h2) {
          h2.scrollIntoView({ behavior: 'instant', block: 'start' });
        }
      }
    });
    await new Promise(r => setTimeout(r, 1000));

    const shotPath2 = path.join(ARTIFACTS_DIR, 'verify_approval_2_all_company_kanban.png');
    await page.screenshot({ path: shotPath2, fullPage: false });
    console.log(`[OK] Screenshot saved: ${shotPath2}`);

    const kanbanData = await page.evaluate(() => {
      let kanbanApprovalColCount = null;
      let kanbanTotalTasks = null;
      const kanbanColumns = {};

      // Kanban Header Total tasks:
      for (const h2 of document.querySelectorAll('h2')) {
        if ((h2.textContent || '').includes('Cross-Client Operations Kanban')) {
          const badge = h2.parentElement?.querySelector('span[class*="rounded-full"]');
          if (badge) {
            const m = badge.textContent.match(/(\d+)\s+Tasks/i);
            if (m) kanbanTotalTasks = parseInt(m[1], 10);
          }
        }
      }

      // 4 Kanban Columns:
      // In line 705-710:
      // <div className="flex items-center justify-between pb-3 mb-3 ...">
      //   <span>{col.title}</span>
      //   <span>{colTasks.length}</span>
      // </div>
      for (const div of document.querySelectorAll('div[class*="justify-between"]')) {
        const titleSpan = div.querySelector('span:first-child');
        const badgeSpan = div.querySelector('span:last-child');
        if (titleSpan && badgeSpan && /^\d+$/.test(badgeSpan.textContent.trim())) {
          const rawTitle = titleSpan.textContent.trim();
          const count = parseInt(badgeSpan.textContent.trim(), 10);
          if (['Pending / Queued', 'In Progress', 'Awaiting Approval', 'Completed'].includes(rawTitle)) {
            kanbanColumns[rawTitle] = count;
            if (rawTitle === 'Awaiting Approval') {
              kanbanApprovalColCount = count;
            }
          }
        }
      }

      return { kanbanApprovalColCount, kanbanTotalTasks, kanbanColumns };
    });

    // 4. Scroll to Quality Assurance & First-Pass Approval Rate
    await page.evaluate(() => {
      const main = document.querySelector('main');
      if (main) {
        const h3 = Array.from(main.querySelectorAll('h3')).find(el => (el.textContent || '').includes('Quality Assurance'));
        if (h3) {
          h3.scrollIntoView({ behavior: 'instant', block: 'center' });
        }
      }
    });
    await new Promise(r => setTimeout(r, 1000));

    const shotPath3 = path.join(ARTIFACTS_DIR, 'verify_approval_3_qa_in_review_queue.png');
    await page.screenshot({ path: shotPath3, fullPage: false });
    console.log(`[OK] Screenshot saved: ${shotPath3}`);

    const qaData = await page.evaluate(() => {
      let qaInReviewCount = null;
      for (const card of document.querySelectorAll('div')) {
        const text = card.innerText || '';
        if (text.includes('IN REVIEW QUEUE') && text.includes('Awaiting management sign-off')) {
          const match = text.match(/IN REVIEW QUEUE[\s\S]*?(\d+)[\s\S]*?Awaiting management sign-off/i);
          if (match) {
            qaInReviewCount = parseInt(match[1], 10);
            break;
          }
        }
      }
      return { qaInReviewCount };
    });

    const statCardNumber = topData.statCardNumber;
    const queueNumber = topData.queueNumber;
    const kanbanApprovalColCount = kanbanData.kanbanApprovalColCount;
    const kanbanTotalTasks = kanbanData.kanbanTotalTasks;
    const kanbanColumns = kanbanData.kanbanColumns;
    const qaInReviewCount = qaData.qaInReviewCount;

    console.log('\n======================================================');
    console.log('--- AWAITING APPROVAL NUMBERS VERIFICATION RESULTS ---');
    console.log('======================================================');
    console.log(`1. Dashboard Stat Card (Awaiting Approval): ${statCardNumber}`);
    console.log(`2. Company Approvals Queue:                 ${queueNumber} Pending`);
    console.log(`3. All Company Kanban Awaiting Approval:    ${kanbanApprovalColCount} (Total Tasks: ${kanbanTotalTasks})`);
    console.log('   Kanban Columns Breakdown:', kanbanColumns);
    console.log(`4. QA In Review Queue:                     ${qaInReviewCount}`);
    console.log('======================================================');

    if (
      statCardNumber !== null &&
      statCardNumber === queueNumber &&
      queueNumber === kanbanApprovalColCount &&
      kanbanApprovalColCount === qaInReviewCount
    ) {
      console.log('\n[PASS] ALL FOUR NUMBERS MATCH IDENTICALLY: ' + statCardNumber);
    } else {
      console.error('\n[FAIL] Discrepancy detected between the four numbers!');
      process.exitCode = 1;
    }

  } catch (err) {
    console.error('Error during verification:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
    cleanupQaUser();
  }
}

verifyApprovalNumbers();
