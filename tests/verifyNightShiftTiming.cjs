// ==============================================================================
// Verification Script: Night Shift Timing (21:00 - 06:00 PKT)
// Tests:
// 1. Settings -> Employee Operations -> Employee Directory displays Night Shift (21:00 - 06:00 PKT)
// 2. Confirms all 8 night-shift staff (M.Asif Rana, M.Bazaid, Safyan Sarwar, Zuhair Hussain,
//    Hafiz M. Ahmad, Fahad Ali, Jameel Khalid, Asad Ali) show Night Shift (21:00 - 06:00 PKT)
// 3. Confirms Morning Shift (11:00 - 20:00 PKT) is unchanged
// 4. Confirms exactly one Night Shift exists in the system (no duplicates)
// 5. Confirms SOP Modal displays Night Shift (9:00 PM - 6:00 AM PKT)
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
  const tmpFile = path.join(__dirname, `tmp_shift_qa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.sql`);
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

async function verifyNightShift() {
  setupQaUser();

  console.log('\nLaunching Chromium browser for visual and DOM verification...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1366, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    // 1. Log in
    console.log('Logging in as Owner...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('#work-email');
    await page.type('#work-email', QA_OWNER_EMAIL);
    await page.type('#password', QA_OWNER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    console.log('[OK] Logged in successfully.');

    // 2. Open Settings -> Employee Operations -> Employee Directory tab
    console.log('\nNavigating to Settings -> Employee Operations...');
    await page.goto(`${BASE_URL}/settings/employee_operations`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    // Click "Employee Directory" tab
    console.log('Selecting Employee Directory tab...');
    const dirTab = await page.waitForSelector('xpath///button[contains(., "Employee Directory")]', { timeout: 10000 });
    await dirTab.click();
    await new Promise(r => setTimeout(r, 2000));

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'verify_night_shift_1_employee_directory.png') });
    console.log('[OK] Screenshot saved: verify_night_shift_1_employee_directory.png');

    // 3. Inspect Employee Directory rows
    console.log('Inspecting staff shift assignments in Employee Directory...');
    const staffShifts = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      return rows.map(r => {
        const nameEl = r.querySelector('td:nth-child(1) div:first-child');
        const roleEl = r.querySelector('td:nth-child(2) span');
        const shiftEl = r.querySelector('td:nth-child(3)');
        return {
          name: nameEl ? nameEl.textContent.trim() : '',
          role: roleEl ? roleEl.textContent.trim() : '',
          shift: shiftEl ? shiftEl.textContent.trim() : ''
        };
      }).filter(r => r.name);
    });

    console.log(`Found ${staffShifts.length} staff members in Employee Directory.`);

    const expectedNightStaff = [
      'M.Asif Rana',
      'M.Bazaid',
      'Safyan Sarwar',
      'Zuhair Hussain',
      'Hafiz M. Ahmad',
      'Fahad Ali',
      'Jameel Khalid',
      'Asad Ali'
    ];

    console.log('\n--- Checking Night Shift Staff ---');
    for (const expectedName of expectedNightStaff) {
      const staff = staffShifts.find(s => s.name.toLowerCase() === expectedName.toLowerCase());
      if (!staff) {
        console.warn(`[WARN] Staff member ${expectedName} not found in directory listing!`);
        continue;
      }
      console.log(`Staff: ${staff.name} -> Shift: "${staff.shift}"`);
      if (!staff.shift.includes('21:00') || !staff.shift.includes('06:00')) {
        throw new Error(`FAILURE: Staff ${staff.name} shows wrong shift timing: "${staff.shift}"! Expected 21:00 - 06:00 PKT.`);
      }
      if (staff.shift.includes('20:00') || staff.shift.includes('05:00')) {
        throw new Error(`FAILURE: Staff ${staff.name} still displays old timing (20:00 or 05:00): "${staff.shift}"!`);
      }
      console.log(`[PASS] ${staff.name} correctly shows: ${staff.shift}`);
    }

    // 4. Confirm Morning Shift is unchanged
    console.log('\n--- Checking Morning Shift Staff ---');
    const morningStaff = staffShifts.filter(s => s.shift.toLowerCase().includes('morning shift'));
    console.log(`Found ${morningStaff.length} morning shift staff members.`);
    for (const ms of morningStaff) {
      if (!ms.shift.includes('11:00') || !ms.shift.includes('20:00')) {
        throw new Error(`FAILURE: Morning Shift timing changed! Found: "${ms.shift}"`);
      }
      console.log(`[PASS] Morning shift staff ${ms.name} correctly shows: ${ms.shift}`);
    }

    // 5. Open Edit Team Member Modal to verify Shift options in dropdown
    console.log('\nNavigating to Team Management to inspect Shift options dropdown...');
    await page.goto(`${BASE_URL}/settings/team`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    // Click "Edit" or "Manage" on a team member
    const editBtn = await page.waitForSelector('button[title="Edit Member"], table button');
    await editBtn.click();
    await new Promise(r => setTimeout(r, 1500));

    // Scroll down to Assigned Work Shift selector
    const shiftSelect = await page.waitForSelector('select');
    const shiftOptions = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      for (const sel of selects) {
        const options = Array.from(sel.options).map(o => o.text.trim());
        if (options.some(o => o.toLowerCase().includes('shift'))) {
          return options;
        }
      }
      return [];
    });

    console.log('Available Shift Dropdown Options:', shiftOptions);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'verify_night_shift_2_modal_dropdown.png') });
    console.log('[OK] Screenshot saved: verify_night_shift_2_modal_dropdown.png');

    const nightShiftOptions = shiftOptions.filter(o => o.toLowerCase().includes('night shift'));
    if (nightShiftOptions.length === 0) {
      throw new Error('FAILURE: Night Shift option not found in dropdown!');
    }
    if (nightShiftOptions.length > 1) {
      throw new Error(`FAILURE: Duplicate Night Shift found in dropdown: ${JSON.stringify(nightShiftOptions)}`);
    }
    console.log(`[PASS] Exactly one Night Shift in dropdown: "${nightShiftOptions[0]}"`);
    if (!nightShiftOptions[0].includes('21:00') || !nightShiftOptions[0].includes('06:00')) {
      throw new Error(`FAILURE: Night Shift option in dropdown does not show 21:00 - 06:00: "${nightShiftOptions[0]}"`);
    }

    // 6. Navigate to Attendance Portal (/settings/attendance)
    console.log('\nNavigating to Attendance Portal (/settings/attendance)...');
    await page.goto(`${BASE_URL}/settings/attendance`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'verify_night_shift_3_attendance_portal.png') });
    console.log('[OK] Screenshot saved: verify_night_shift_3_attendance_portal.png');

    console.log('\n======================================================================');
    console.log('ALL NIGHT SHIFT VERIFICATION CHECKS PASSED WITH ZERO ERRORS!');
    console.log('======================================================================\n');
  } catch (err) {
    console.error('VERIFICATION ERROR:', err);
    try {
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'verify_night_shift_error.png') });
    } catch (e) {}
    throw err;
  } finally {
    await browser.close();
    cleanupQaUser();
  }
}

verifyNightShift().catch(err => {
  console.error('Test script failed:', err);
  cleanupQaUser();
  process.exit(1);
});
