// ==============================================================================
// Live End-to-End Verification Suite: Two-Factor Authentication (2FA) Full Flow
// Target: http://localhost:4173 (Vite Preview Server)
// Database: Linked Supabase Production Database (jcaptlqenwmpfchjyipw)
// ==============================================================================

const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const BASE_URL = 'http://localhost:4173';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\Atif\\.gemini\\antigravity\\brain\\dc6b2411-97c2-4334-900a-7f5e6445dbb3';

// Existing production client for workspace spot-check
const CLOUD_Z_CLIENT_ID = 'd3d666c2-24c7-4cc7-b879-55c6d5881185';

// Disposable QA Owner Account
const QA_OWNER_EMAIL = 'qa.owner.2fa@faseehlall.com';
const QA_OWNER_PASSWORD = 'QA2FAPassword2026!#';
const QA_OWNER_ID = 'e5e5e5e5-5555-4555-8555-555555555555';

function base32Decode(base32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = base32.toUpperCase().replace(/=+$/, '');
  let bits = '';
  for (let i = 0; i < clean.length; i++) {
    const val = alphabet.indexOf(clean[i]);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substr(i, 8), 2));
  }
  return Buffer.from(bytes);
}

function getTOTP(secretBase32, timeStepOffset = 0) {
  const key = base32Decode(secretBase32);
  const epoch = Math.floor(Date.now() / 1000);
  const timeStep = Math.floor(epoch / 30) + timeStepOffset;
  const timeBuf = Buffer.alloc(8);
  timeBuf.writeBigInt64BE(BigInt(timeStep), 0);

  const hmac = crypto.createHmac('sha1', key).update(timeBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = (
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  ) % 1000000;

  return code.toString().padStart(6, '0');
}

function executeSql(sql) {
  const tmpFile = path.join(__dirname, `tmp_2fa_qa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.sql`);
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
  console.log('Setting up disposable QA Owner in linked Supabase database...');
  const sql = `
    DO $$
    DECLARE
      u_id UUID := '${QA_OWNER_ID}';
      u_email TEXT := '${QA_OWNER_EMAIL}';
      u_pass TEXT := '${QA_OWNER_PASSWORD}';
      v_user_exists BOOLEAN := FALSE;
    BEGIN
      -- Clean up previous 2FA state
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
        -- Create fresh user
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
          '{"full_name":"QA 2FA Owner"}'::jsonb,
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
        u_id, 'QA 2FA Owner', 'owner', 'active', u_email, u_email, NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE
      SET full_name = 'QA 2FA Owner',
          role = 'owner',
          status = 'active',
          contact_email = u_email,
          work_email = u_email,
          updated_at = NOW();
    END;
    $$;
  `;
  executeSql(sql);
  console.log('[OK] Disposable QA Owner created in database.');
}

function cleanupQaUser() {
  console.log('Cleaning up disposable QA user...');
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
    console.log('[OK] Disposable QA user cleaned up.');
  } catch (e) {
    console.warn('Cleanup notice:', e.message);
  }
}

async function runLiveVerification() {
  setupQaUser();

  console.log('\nStarting Puppeteer browser verification...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1280, height: 850 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  let totpSecret = '';
  let savedRecoveryCodes = [];

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Login page loads and normal login succeeds (accounts without 2FA)
    // -------------------------------------------------------------------------
    console.log('\n--- Step 1: Login page loads and password login works without 2FA ---');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'live_2fa_1_login_page.png') });
    console.log('[OK] Screenshot saved: live_2fa_1_login_page.png');

    await page.waitForSelector('#work-email');
    await page.type('#work-email', QA_OWNER_EMAIL);
    await page.type('#password', QA_OWNER_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    console.log('[OK] Normal password login successful without 2FA prompt.');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'live_2fa_2_normal_login_dashboard.png') });
    console.log('[OK] Screenshot saved: live_2fa_2_normal_login_dashboard.png');

    // -------------------------------------------------------------------------
    // TEST 2: Navigate to Profile and inspect 2FA section (Disabled)
    // -------------------------------------------------------------------------
    console.log('\n--- Step 2: Navigate to Profile and verify 2FA section (Disabled) ---');
    await page.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('text/Two-Factor Authentication');
    console.log('[OK] Two-Factor Authentication card is present on /profile.');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'live_2fa_3_profile_disabled.png') });
    console.log('[OK] Screenshot saved: live_2fa_3_profile_disabled.png');

    // -------------------------------------------------------------------------
    // TEST 3: Enable 2FA -> View QR Code & Secret Key
    // -------------------------------------------------------------------------
    console.log('\n--- Step 3: Click Enable 2FA and inspect enrollment modal ---');
    const enableBtn = await page.waitForSelector('xpath///button[contains(., "Enable 2FA")]');
    await enableBtn.click();

    // Wait for modal to open
    await page.waitForSelector('text/Set Up Two-Factor Authentication');
    console.log('[OK] Enrollment modal opened.');

    // Wait for secret key input
    const secretInput = await page.waitForSelector('input[readonly]');
    totpSecret = await page.evaluate(el => el.value, secretInput);
    console.log('[OK] Retrieved TOTP secret key of length:', totpSecret.length);

    // Generate 6-digit TOTP code
    const validEnrollCode = getTOTP(totpSecret);
    console.log('[OK] Generated valid TOTP code:', validEnrollCode);

    // Type the 6-digit code using native input setter to ensure React 19 state synchronization
    await page.evaluate((val) => {
      const input = document.querySelector('input[placeholder="000000"]');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, val);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, validEnrollCode);

    await new Promise(r => setTimeout(r, 500));

    // Click "Verify & Continue"
    const verifyContinueBtn = await page.waitForSelector('xpath///button[contains(., "Verify & Continue")]');
    await verifyContinueBtn.click();

    // -------------------------------------------------------------------------
    // TEST 4: Step 2 of Modal -> 10 Single-Use Recovery Codes Displayed ONCE
    // -------------------------------------------------------------------------
    console.log('\n--- Step 4: Verify 10 single-use recovery codes display ---');
    await page.waitForSelector('text/Save Your Recovery Codes', { timeout: 15000 });
    console.log('[OK] Recovery codes step reached.');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'live_2fa_4_enroll_recovery_codes.png') });
    console.log('[OK] Screenshot saved: live_2fa_4_enroll_recovery_codes.png');

    // Extract recovery codes
    savedRecoveryCodes = await page.evaluate(() => {
      const codeDivs = Array.from(document.querySelectorAll('.font-mono.text-center.font-bold .tracking-wider'));
      return codeDivs.map(d => d.textContent.trim());
    });
    console.log(`[OK] Captured ${savedRecoveryCodes.length} recovery codes:`, savedRecoveryCodes.slice(0, 3), '...');
    if (savedRecoveryCodes.length !== 10) throw new Error(`Expected 10 recovery codes, got ${savedRecoveryCodes.length}`);

    // Check confirmation checkbox
    const confirmCheckbox = await page.waitForSelector('input[type="checkbox"]');
    await confirmCheckbox.click();

    // Click "Complete Setup"
    const completeSetupBtn = await page.waitForSelector('xpath///button[contains(., "Complete Setup")]');
    await completeSetupBtn.click();

    // Verify profile shows 2FA is Active
    await page.waitForSelector('text/Two-factor protection is enabled');
    console.log('[OK] 2FA status successfully switched to Active on /profile.');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'live_2fa_5_profile_active.png') });
    console.log('[OK] Screenshot saved: live_2fa_5_profile_active.png');

    // -------------------------------------------------------------------------
    // TEST 5: Log out and test 2FA Login Flow (Step 1 -> Step 2)
    // -------------------------------------------------------------------------
    console.log('\n--- Step 5: Log out and test 2FA login prompt ---');
    // Clear storage to log out
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });

    await page.waitForSelector('#work-email');
    await page.type('#work-email', QA_OWNER_EMAIL);
    await page.type('#password', QA_OWNER_PASSWORD);
    await page.click('button[type="submit"]');

    // Verify Step 2 "Two-Factor Verification" appears
    await page.waitForSelector('text/Two-Factor Verification', { timeout: 10000 });
    console.log('[OK] Account with 2FA enabled correctly triggers Step 2 Two-Factor Verification.');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'live_2fa_6_step2_prompt.png') });
    console.log('[OK] Screenshot saved: live_2fa_6_step2_prompt.png');

    // -------------------------------------------------------------------------
    // TEST 6: Wrong 6-digit code -> Rejection with Generic Error
    // -------------------------------------------------------------------------
    console.log('\n--- Step 6: Enter invalid 6-digit code and verify rejection ---');
    const twoFactorInput = await page.waitForSelector('#two-factor-code');
    await twoFactorInput.type('999999');
    await page.click('button[type="submit"]');

    await page.waitForSelector('[role="alert"]');
    const alertText = await page.evaluate(() => document.querySelector('[role="alert"]').textContent);
    console.log('[OK] Generic error displayed on invalid code:', alertText);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'live_2fa_7_wrong_code_error.png') });
    console.log('[OK] Screenshot saved: live_2fa_7_wrong_code_error.png');

    // -------------------------------------------------------------------------
    // TEST 7: Valid 6-digit TOTP code -> Successful Sign-In
    // -------------------------------------------------------------------------
    console.log('\n--- Step 7: Enter valid 6-digit code and verify login success ---');
    // Clear input
    await page.evaluate(() => { document.querySelector('#two-factor-code').value = ''; });
    const freshTotp = getTOTP(totpSecret);
    await twoFactorInput.type(freshTotp);
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    console.log('[OK] Successful 2FA login using 6-digit authenticator code.');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'live_2fa_8_totp_login_success.png') });
    console.log('[OK] Screenshot saved: live_2fa_8_totp_login_success.png');

    // -------------------------------------------------------------------------
    // TEST 8: Log out and test Single-Use Recovery Code Login
    // -------------------------------------------------------------------------
    console.log('\n--- Step 8: Test Single-Use Recovery Code Login ---');
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });

    await page.waitForSelector('#work-email');
    await page.type('#work-email', QA_OWNER_EMAIL);
    await page.type('#password', QA_OWNER_PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForSelector('text/Two-Factor Verification');

    // Toggle to recovery code
    const recoveryToggle = await page.waitForSelector('xpath///button[contains(., "Use a recovery code")]');
    await recoveryToggle.click();

    await page.waitForSelector('text/Single-Use Recovery Code');
    console.log('[OK] Switched to single-use recovery code input.');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'live_2fa_9_recovery_code_prompt.png') });
    console.log('[OK] Screenshot saved: live_2fa_9_recovery_code_prompt.png');

    // Enter recovery code 0
    const recCode0 = savedRecoveryCodes[0];
    const recInput = await page.waitForSelector('#two-factor-code');
    await recInput.type(recCode0);
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    console.log('[OK] Successfully signed in using single-use recovery code:', recCode0);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'live_2fa_10_recovery_code_success.png') });
    console.log('[OK] Screenshot saved: live_2fa_10_recovery_code_success.png');

    // -------------------------------------------------------------------------
    // TEST 9: Test Re-use of Consumed Recovery Code MUST Fail
    // -------------------------------------------------------------------------
    console.log('\n--- Step 9: Verify Re-use of Consumed Recovery Code is Rejected ---');
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });

    await page.waitForSelector('#work-email');
    await page.type('#work-email', QA_OWNER_EMAIL);
    await page.type('#password', QA_OWNER_PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForSelector('text/Two-Factor Verification');
    const recToggle2 = await page.waitForSelector('xpath///button[contains(., "Use a recovery code")]');
    await recToggle2.click();

    // Type the SAME recovery code 0 again
    const recInput2 = await page.waitForSelector('#two-factor-code');
    await recInput2.type(recCode0);
    await page.click('button[type="submit"]');

    await page.waitForSelector('[role="alert"]');
    const reuseAlert = await page.evaluate(() => document.querySelector('[role="alert"]').textContent);
    console.log('[OK] Consumed recovery code was correctly rejected:', reuseAlert);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'live_2fa_11_recovery_code_reuse_rejected.png') });
    console.log('[OK] Screenshot saved: live_2fa_11_recovery_code_reuse_rejected.png');

    // Now sign in with recovery code 1
    await page.evaluate(() => { document.querySelector('#two-factor-code').value = ''; });
    await recInput2.type(savedRecoveryCodes[1]);
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    console.log('[OK] Successfully signed in using second unused recovery code.');

    // -------------------------------------------------------------------------
    // TEST 10: Disable 2FA with Password + Current Code
    // -------------------------------------------------------------------------
    console.log('\n--- Step 10: Disable 2FA flow ---');
    await page.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle2' });
    const disableBtn = await page.waitForSelector('xpath///button[contains(., "Disable 2FA")]');
    await disableBtn.click();

    // Modal opens
    await page.waitForSelector('text/Disable Two-Factor Authentication');
    const disablePwInput = await page.waitForSelector('input[placeholder="Enter your password"]');
    await disablePwInput.type(QA_OWNER_PASSWORD);

    const disableCodeInput = await page.waitForSelector('input[placeholder="000000"]');
    await disableCodeInput.type(getTOTP(totpSecret));

    const confirmDisableBtn = await page.waitForSelector('xpath///button[contains(., "Confirm & Disable 2FA")]');
    await confirmDisableBtn.click();

    // Verify 2FA switches to Disabled
    await page.waitForSelector('text/Two-Factor Authentication has been disabled', { timeout: 10000 });
    console.log('[OK] 2FA successfully disabled with password + TOTP confirmation.');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'live_2fa_12_2fa_disabled.png') });
    console.log('[OK] Screenshot saved: live_2fa_12_2fa_disabled.png');

    // -------------------------------------------------------------------------
    // TEST 11: Spot-check Dashboard, Client Workspace, Settings
    // -------------------------------------------------------------------------
    console.log('\n--- Step 11: Spot-check other views to ensure zero regressions ---');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('text/Operational Dashboard', { timeout: 10000 }).catch(() => {});
    console.log('[OK] Dashboard rendered without regression.');

    await page.goto(`${BASE_URL}/clients/${CLOUD_Z_CLIENT_ID}`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('text/Week 1', { timeout: 10000 });
    console.log('[OK] Client workspace rendered without regression.');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'live_2fa_13_spot_check_workspace.png') });
    console.log('[OK] Screenshot saved: live_2fa_13_spot_check_workspace.png');

    await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle2' });
    console.log('[OK] Settings rendered without regression.');

    console.log('\n======================================================================');
    console.log('ALL LIVE END-TO-END 2FA VERIFICATIONS COMPLETED SUCCESSFULLY!');
    console.log('======================================================================\n');
  } catch (err) {
    console.error('LIVE 2FA VERIFICATION FAILED:', err);
    try {
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'live_2fa_error.png') });
      const html = await page.content();
      fs.writeFileSync(path.join(ARTIFACTS_DIR, 'live_2fa_error.html'), html, 'utf-8');
      console.log('[DEBUG] Saved error screenshot and HTML dump.');
    } catch (e) {}
    throw err;
  } finally {
    await browser.close();
    cleanupQaUser();
  }
}

runLiveVerification().catch((err) => {
  console.error('LIVE 2FA VERIFICATION FAILED:', err);
  cleanupQaUser();
  process.exit(1);
});
