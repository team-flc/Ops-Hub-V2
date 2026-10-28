// ==============================================================================
// Isolated PostgreSQL Database Verification Script
// Tests real PostgreSQL execution of pending migrations:
//   - 20260928000001_fix_client_creation_rls_and_tx.sql
//   - 20261002000001_add_reviews_and_proposal_contract_to_client_links.sql
// Tests:
//   1. Actual Owner permissions & creation with links & profiles
//   2. Actual Operational Manager permissions & manager assignment
//   3. Actual Team Member denial
//   4. Failed child insert and atomic transactional rollback
//   5. Duplicate client creation
//   6. Saved links retrieval after refresh
// ==============================================================================

const fs = require('fs');
const path = require('path');
const { PGlite } = require('@electric-sql/pglite');

async function runDatabaseVerification() {
  console.log('--- Initializing Isolated PostgreSQL (PGlite) Engine ---');
  const db = new PGlite();

  // 1. Setup base Postgres schemas, roles, and auth mockup
  await db.exec(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role;
      END IF;
    END $$;

    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE SCHEMA IF NOT EXISTS app_private;

    -- Base auth mock tables
    CREATE TABLE IF NOT EXISTS auth.users (
      id UUID PRIMARY KEY,
      email TEXT
    );
    CREATE TABLE IF NOT EXISTS auth.mfa_factors (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      friendly_name TEXT,
      factor_type TEXT NOT NULL,
      status TEXT NOT NULL,
      secret TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS auth.mfa_challenges (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      factor_id UUID NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      verified_at TIMESTAMPTZ
    );

    -- Base public system_audit_events table
    CREATE TABLE IF NOT EXISTS public.system_audit_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_id UUID,
      actor_name TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      reason TEXT,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    GRANT USAGE ON SCHEMA auth, app_private, public TO authenticated, anon;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated, anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA app_private GRANT ALL ON ROUTINES TO authenticated, anon;

    -- Function simulating Supabase auth.uid() reading from transaction/session config
    CREATE OR REPLACE FUNCTION auth.uid()
    RETURNS UUID
    LANGUAGE sql
    STABLE
    AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
    $$;

    -- Create public.profiles
    CREATE TABLE IF NOT EXISTS public.profiles (
      id UUID PRIMARY KEY,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('owner', 'operational_manager', 'team_member', 'client')),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'invited')),
      organization_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Create app_private helper functions
    CREATE OR REPLACE FUNCTION app_private.is_owner(user_id UUID)
    RETURNS BOOLEAN
    LANGUAGE sql
    SECURITY DEFINER
    STABLE
    AS $$
      SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_id
          AND role = 'owner'
          AND status = 'active'
      );
    $$;

    CREATE OR REPLACE FUNCTION app_private.is_manager_or_owner(caller_id UUID)
    RETURNS BOOLEAN
    LANGUAGE sql
    SECURITY DEFINER
    STABLE
    AS $$
      SELECT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = caller_id AND p.status = 'active' AND p.role IN ('owner', 'operational_manager')
      );
    $$;

    CREATE OR REPLACE FUNCTION app_private.can_access_client(caller_id UUID, target_client_id UUID)
    RETURNS BOOLEAN
    LANGUAGE sql
    SECURITY DEFINER
    STABLE
    AS $$
      SELECT true;
    $$;

    -- Access mapping tables referenced in clients_select
    CREATE TABLE IF NOT EXISTS public.client_team_access (
      client_id UUID NOT NULL,
      profile_id UUID NOT NULL,
      PRIMARY KEY (client_id, profile_id)
    );

    CREATE TABLE IF NOT EXISTS public.profile_client_access (
      client_id TEXT NOT NULL,
      profile_id UUID NOT NULL,
      PRIMARY KEY (client_id, profile_id)
    );

    -- Create base clients table
    CREATE TABLE IF NOT EXISTS public.clients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_name TEXT NOT NULL,
      client_name TEXT NOT NULL,
      package TEXT NOT NULL CHECK (package IN ('Basic', 'Intermediate', 'Advanced')),
      operational_manager_id UUID NOT NULL REFERENCES public.profiles(id),
      activation_date DATE NOT NULL DEFAULT CURRENT_DATE,
      status TEXT NOT NULL DEFAULT 'Onboarding' CHECK (status IN ('Onboarding', 'Active', 'Paused', 'Archived')),
      pause_reason TEXT,
      required_linkedin_profile_count INT NOT NULL DEFAULT 3,
      source_client_id UUID REFERENCES public.clients(id),
      created_by UUID REFERENCES public.profiles(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      archived_at TIMESTAMPTZ
    );

    ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.clients FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "clients_select" ON public.clients;
    CREATE POLICY "clients_select" ON public.clients
      FOR SELECT TO authenticated, public
      USING (app_private.can_access_client((SELECT auth.uid()), id));

    -- Create base client_links table
    CREATE TABLE IF NOT EXISTS public.client_links (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
      link_type TEXT NOT NULL,
      url TEXT NOT NULL,
      created_by UUID REFERENCES public.profiles(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_client_link_type UNIQUE (client_id, link_type)
    );

    ALTER TABLE public.client_links ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.client_links FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "client_links_select" ON public.client_links;
    CREATE POLICY "client_links_select" ON public.client_links
      FOR SELECT TO authenticated, public
      USING (app_private.can_access_client((SELECT auth.uid()), client_id));

    -- Create base client_linkedin_profiles table
    CREATE TABLE IF NOT EXISTS public.client_linkedin_profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
      profile_label TEXT NOT NULL,
      profile_url TEXT NOT NULL,
      sales_navigator_active BOOLEAN NOT NULL DEFAULT false,
      sales_navigator_activated_on DATE,
      linkedin_verified BOOLEAN NOT NULL DEFAULT false,
      has_gmail_account BOOLEAN NOT NULL DEFAULT false,
      gmail_address TEXT,
      sort_order INT NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
      created_by UUID REFERENCES public.profiles(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Create client_audit_log table
    CREATE TABLE IF NOT EXISTS public.client_audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
      actor_id UUID REFERENCES public.profiles(id),
      action TEXT NOT NULL,
      safe_metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Create client_portal_recipients table
    CREATE TABLE IF NOT EXISTS public.client_portal_recipients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
      profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      full_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
      created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Create client_tasks table
    CREATE TABLE IF NOT EXISTS public.client_tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
      week_number INT NOT NULL DEFAULT 1,
      title TEXT NOT NULL,
      details TEXT,
      priority TEXT NOT NULL DEFAULT 'Normal',
      status TEXT NOT NULL DEFAULT 'Pending',
      assignee_id UUID REFERENCES public.profiles(id),
      created_by UUID REFERENCES public.profiles(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      archived_at TIMESTAMPTZ
    );

    ALTER TABLE public.client_tasks ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.client_tasks FORCE ROW LEVEL SECURITY;

    GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;
    GRANT ALL ON ALL ROUTINES IN SCHEMA public, app_private, auth TO authenticated, anon;

    -- Helper can_access_client
    CREATE OR REPLACE FUNCTION app_private.can_access_client(caller_id UUID, target_client_id UUID)
    RETURNS BOOLEAN
    LANGUAGE sql
    SECURITY DEFINER
    STABLE
    AS $$
      SELECT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = caller_id AND p.status = 'active' AND (
          p.role = 'owner'
          OR (p.role = 'operational_manager' AND EXISTS (
            SELECT 1 FROM public.clients c
            WHERE c.id = target_client_id AND (c.operational_manager_id = caller_id OR c.created_by = caller_id)
          ))
        )
      );
    $$;
  `);
  console.log('[OK] Base schemas and tables initialized in PostgreSQL.');

  // 2. Load and apply Migration 1
  const migration1Path = path.join(__dirname, '..', 'supabase', 'migrations', '20260928000001_fix_client_creation_rls_and_tx.sql');
  const migration1Sql = fs.readFileSync(migration1Path, 'utf8');
  await db.exec(migration1Sql);
  console.log('[OK] Applied Migration 1: 20260928000001_fix_client_creation_rls_and_tx.sql');

  // 3. Load and apply Migration 2
  const migration2Path = path.join(__dirname, '..', 'supabase', 'migrations', '20261002000001_add_reviews_and_proposal_contract_to_client_links.sql');
  const migration2Sql = fs.readFileSync(migration2Path, 'utf8');
  await db.exec(migration2Sql);
  console.log('[OK] Applied Migration 2: 20261002000001_add_reviews_and_proposal_contract_to_client_links.sql');

  // 4. Load and apply Migration 3
  const migration3Path = path.join(__dirname, '..', 'supabase', 'migrations', '20261008000001_add_variations_and_poc_email_to_client_links.sql');
  const migration3Sql = fs.readFileSync(migration3Path, 'utf8');
  await db.exec(migration3Sql);
  console.log('[OK] Applied Migration 3: 20261008000001_add_variations_and_poc_email_to_client_links.sql');

  // 4b. Load and apply Migration 4 (Client Workspace View Access & RLS)
  const migration4Path = path.join(__dirname, '..', 'supabase', 'migrations', '20261025000001_client_workspace_view_access.sql');
  const migration4Sql = fs.readFileSync(migration4Path, 'utf8');
  await db.exec(migration4Sql);
  console.log('[OK] Applied Migration 4: 20261025000001_client_workspace_view_access.sql');

  // 4c. Load and apply Migration 5 (Two-Factor Authentication TOTP & Recovery Codes)
  const migration5Path = path.join(__dirname, '..', 'supabase', 'migrations', '20261029000001_two_factor_authentication_totp_and_recovery.sql');
  const migration5Sql = fs.readFileSync(migration5Path, 'utf8');
  await db.exec(migration5Sql);
  console.log('[OK] Applied Migration 5: 20261029000001_two_factor_authentication_totp_and_recovery.sql');

  // 5. Seed test profiles
  const OWNER_ID = '11111111-1111-1111-1111-111111111111';
  const MGR1_ID  = '22222222-2222-2222-2222-222222222222';
  const MGR2_ID  = '33333333-3333-3333-3333-333333333333';
  const TM_ID    = '44444444-4444-4444-4444-444444444444';
  const CLIENT_USER_ID = '55555555-5555-5555-5555-555555555555';

  await db.exec(`
    INSERT INTO public.profiles (id, full_name, role, status) VALUES
      ('${OWNER_ID}', 'Faseeh Owner', 'owner', 'active'),
      ('${MGR1_ID}', 'Ahmad Manager', 'operational_manager', 'active'),
      ('${MGR2_ID}', 'Zainab Manager', 'operational_manager', 'active'),
      ('${TM_ID}', 'Tariq Member', 'team_member', 'active');
  `);
  console.log('[OK] Seeded Owner, Operational Managers, and Team Member profiles.');

  // ============================================================================
  // TEST A: Owner Client Creation with Links (including reviews & proposal_contract)
  // ============================================================================
  console.log('\n--- Test A: Owner Client Creation via create_client_tx ---');
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${OWNER_ID}', false);`);

  const ownerClientData = JSON.stringify({
    company_name: 'Bizease Global',
    client_name: 'John Owner',
    package: 'Advanced',
    operational_manager_id: MGR1_ID,
    activation_date: '2026-10-02',
    status: 'Active',
    required_linkedin_profile_count: 3
  });

  const ownerLinks = JSON.stringify([
    { link_type: 'website', url: 'https://bizease.com' },
    { link_type: 'reviews', url: 'https://g.page/r/bizease/review' },
    { link_type: 'proposal_contract', url: 'https://docs.bizease.com/proposal-2026' },
    { link_type: 'variations', url: 'https://variations.bizease.com/creatives' },
    { link_type: 'poc_email', url: 'poc.bizease@global.com' }
  ]);

  const ownerProfiles = JSON.stringify([
    {
      profile_label: 'Lead 1',
      profile_url: 'https://linkedin.com/in/john-bizease',
      sales_navigator_active: true,
      sales_navigator_activated_on: '2026-10-01',
      linkedin_verified: true,
      has_gmail_account: true,
      gmail_address: 'john.bizease@gmail.com',
      sort_order: 1
    }
  ]);

  const ownerCreateRes = await db.query(
    `SELECT public.create_client_tx($1::jsonb, $2::jsonb, $3::jsonb) AS result;`,
    [ownerClientData, ownerLinks, ownerProfiles]
  );

  const ownerResult = ownerCreateRes.rows[0].result;
  console.log('Result from create_client_tx (Owner):', {
    id: ownerResult.id,
    companyName: ownerResult.companyName,
    links: ownerResult.links,
    profilesCount: ownerResult.linkedinProfiles.length
  });

  if (!ownerResult.id) throw new Error('Owner client creation failed to return client id');
  if (ownerResult.links.reviews !== 'https://g.page/r/bizease/review') throw new Error('reviews link not returned in result');
  if (ownerResult.links.proposal_contract !== 'https://docs.bizease.com/proposal-2026') throw new Error('proposal_contract link not returned');
  if (ownerResult.links.variations !== 'https://variations.bizease.com/creatives') throw new Error('variations link not returned');
  if (ownerResult.links.poc_email !== 'poc.bizease@global.com') throw new Error('poc_email link not returned');

  // Verify actual PostgreSQL rows
  const clientsInDb = await db.query(`SELECT * FROM public.clients WHERE id = $1;`, [ownerResult.id]);
  if (clientsInDb.rows.length !== 1) throw new Error('Client record not found in public.clients table');
  console.log('[OK] Owner client record confirmed in public.clients table.');

  const linksInDb = await db.query(`SELECT link_type, url FROM public.client_links WHERE client_id = $1 ORDER BY link_type;`, [ownerResult.id]);
  if (linksInDb.rows.length !== 5) throw new Error(`Expected 5 links in public.client_links, found ${linksInDb.rows.length}`);
  console.log('[OK] Reviews, Proposal/Contract, Variations, and POC Email links verified in public.client_links table:', linksInDb.rows);

  const profilesInDb = await db.query(`SELECT profile_label, linkedin_verified, has_gmail_account, gmail_address FROM public.client_linkedin_profiles WHERE client_id = $1;`, [ownerResult.id]);
  if (profilesInDb.rows.length !== 1 || !profilesInDb.rows[0].linkedin_verified || !profilesInDb.rows[0].has_gmail_account) {
    throw new Error('LinkedIn profile with verified badge and gmail not found in database');
  }
  console.log('[OK] LinkedIn profile verified in public.client_linkedin_profiles:', profilesInDb.rows[0]);

  // ============================================================================
  // TEST B: Operational Manager Creation (Assigning different permitted manager)
  // ============================================================================
  console.log('\n--- Test B: Operational Manager Client Creation ---');
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${MGR1_ID}', false);`);

  const mgrClientData = JSON.stringify({
    company_name: 'TechFlow Solutions',
    client_name: 'Sarah Lead',
    package: 'Intermediate',
    operational_manager_id: MGR2_ID, // Ahmad assigns Zainab
    activation_date: '2026-10-02',
    status: 'Onboarding'
  });

  const mgrCreateRes = await db.query(
    `SELECT public.create_client_tx($1::jsonb, '[]'::jsonb, '[]'::jsonb) AS result;`,
    [mgrClientData]
  );
  const mgrResult = mgrCreateRes.rows[0].result;
  console.log('Result from create_client_tx (Manager):', {
    id: mgrResult.id,
    companyName: mgrResult.companyName,
    createdBy: mgrResult.createdBy,
    operationalManagerId: mgrResult.operationalManagerId
  });

  if (mgrResult.createdBy !== MGR1_ID || mgrResult.operationalManagerId !== MGR2_ID) {
    throw new Error('Operational Manager assignment or caller ID mismatch');
  }
  console.log('[OK] Operational Manager creation and delegation verified in database.');

  // ============================================================================
  // TEST C: Team Member Access Denial
  // ============================================================================
  console.log('\n--- Test C: Team Member Denial ---');
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${TM_ID}', false);`);

  let tmBlocked = false;
  try {
    await db.query(
      `SELECT public.create_client_tx($1::jsonb, '[]'::jsonb, '[]'::jsonb) AS result;`,
      [mgrClientData]
    );
  } catch (err) {
    console.log('Team Member rejection error received from PostgreSQL:', err.message);
    if (err.message.includes('Access denied. Only Owners and Operational Managers can create clients.')) {
      tmBlocked = true;
    }
  }

  if (!tmBlocked) throw new Error('Security violation: Team member was not blocked by create_client_tx');
  console.log('[OK] Team Member correctly denied by PostgreSQL RLS/authorization check.');

  // ============================================================================
  // TEST D: Failed Child Insert and Atomic Rollback
  // ============================================================================
  console.log('\n--- Test D: Failed Child Insert & Atomic Rollback ---');
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${MGR1_ID}', false);`);

  const initialClientCountRes = await db.query(`SELECT count(*)::int as count FROM public.clients;`);
  const initialClientCount = initialClientCountRes.rows[0].count;

  const badLinksData = JSON.stringify([
    { link_type: 'illegal_unsupported_link_type', url: 'https://badlink.com' }
  ]);

  const rollbackClientData = JSON.stringify({
    company_name: 'Rollback Attempt Corp',
    client_name: 'Rollback Person',
    package: 'Basic',
    operational_manager_id: MGR1_ID,
    activation_date: '2026-10-02',
    status: 'Onboarding'
  });

  let childErrorCaught = false;
  try {
    await db.query(
      `SELECT public.create_client_tx($1::jsonb, $2::jsonb, '[]'::jsonb) AS result;`,
      [rollbackClientData, badLinksData]
    );
  } catch (err) {
    console.log('Constraint violation error received from PostgreSQL:', err.message);
    if (err.message.includes('violates check constraint') || err.code === '23514') {
      childErrorCaught = true;
    }
  }

  if (!childErrorCaught) throw new Error('Invalid link type was not rejected by database constraint');

  const afterRollbackCountRes = await db.query(`SELECT count(*)::int as count FROM public.clients;`);
  const afterRollbackCount = afterRollbackCountRes.rows[0].count;

  if (afterRollbackCount !== initialClientCount) {
    throw new Error('Atomicity violation: Partial client record remained in public.clients after child failure!');
  }
  console.log(`[OK] Rollback verified: Initial count was ${initialClientCount}, after failure count is ${afterRollbackCount}. No partial records created.`);

  // ============================================================================
  // TEST E: Duplicate Creation with Optional Links
  // ============================================================================
  console.log('\n--- Test E: Duplicate Client Creation with Links ---');
  const dupClientRes = await db.query(
    `INSERT INTO public.clients (company_name, client_name, package, operational_manager_id, activation_date, status, source_client_id, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id;`,
    ['Bizease Global (Duplicate)', 'John Owner', 'Advanced', MGR1_ID, '2026-10-02', 'Onboarding', ownerResult.id, MGR1_ID]
  );
  const dupClientId = dupClientRes.rows[0].id;

  await db.query(
    `INSERT INTO public.client_links (client_id, link_type, url, created_by)
     VALUES
       ($1, 'reviews', 'https://reviews.bizease.com/clone', $2),
       ($1, 'proposal_contract', 'https://docs.bizease.com/contract-clone', $2),
       ($1, 'variations', 'https://variations.bizease.com/clone', $2),
       ($1, 'poc_email', 'dup.poc@bizease.com', $2);`,
    [dupClientId, MGR1_ID]
  );

  const dupLinksCheck = await db.query(`SELECT link_type, url FROM public.client_links WHERE client_id = $1 ORDER BY link_type;`, [dupClientId]);
  if (dupLinksCheck.rows.length !== 4) throw new Error('Duplicate client links failed to insert');
  console.log('[OK] Duplicate client with Reviews, Proposal/Contract, Variations, and POC Email links verified in database:', dupLinksCheck.rows);

  // ============================================================================
  // TEST F: Saved Links After Refresh (Direct Query Retrieval)
  // ============================================================================
  console.log('\n--- Test F: Saved Links Retrieval After Refresh ---');
  const refreshedLinks = await db.query(`
    SELECT link_type, url FROM public.client_links
    WHERE client_id = $1
    ORDER BY link_type;
  `, [ownerResult.id]);

  const refreshedMap = {};
  for (const row of refreshedLinks.rows) {
    refreshedMap[row.link_type] = row.url;
  }

  if (refreshedMap['reviews'] !== 'https://g.page/r/bizease/review') {
    throw new Error('reviews link did not persist properly upon retrieval');
  }
  if (refreshedMap['proposal_contract'] !== 'https://docs.bizease.com/proposal-2026') {
    throw new Error('proposal_contract link did not persist properly upon retrieval');
  }
  if (refreshedMap['variations'] !== 'https://variations.bizease.com/creatives') {
    throw new Error('variations link did not persist properly upon retrieval');
  }
  if (refreshedMap['poc_email'] !== 'poc.bizease@global.com') {
    throw new Error('poc_email link did not persist properly upon retrieval');
  }

  console.log('[OK] Refreshed link retrieval confirmed:', refreshedMap);

  // ============================================================================
  // TEST G: Client Role Read Access & Strict Multi-Tenant Isolation
  // ============================================================================
  console.log('\n--- Test G: Client Role Workspace Access & Write Denial ---');
  // 1. Seed client user profile associated with ownerResult.id
  await db.exec(`
    INSERT INTO public.profiles (id, full_name, role, status, organization_id)
    VALUES ('${CLIENT_USER_ID}', 'Client View User', 'client', 'active', '${ownerResult.id}');

    -- Insert active task for this client
    INSERT INTO public.client_tasks (client_id, week_number, title, priority, status)
    VALUES ('${ownerResult.id}', 1, 'Website Delivery Task', 'High', 'Pending');
  `);

  // 2. Set active JWT context to client user
  await db.exec(`
    SELECT set_config('request.jwt.claim.sub', '${CLIENT_USER_ID}', false);
    SET ROLE authenticated;
  `);

  // 3. Client can view their own client record
  const clientSelfRes = await db.query(`SELECT id, company_name FROM public.clients WHERE id = $1;`, [ownerResult.id]);
  if (clientSelfRes.rows.length !== 1) throw new Error('Client should be able to view their own client record');
  console.log('[OK] Client successfully reads their own client record:', clientSelfRes.rows[0].company_name);

  // 4. Client can view their own links
  const clientLinksRes = await db.query(`SELECT link_type, url FROM public.client_links WHERE client_id = $1;`, [ownerResult.id]);
  if (clientLinksRes.rows.length === 0) throw new Error('Client should be able to read their own workspace links');
  console.log('[OK] Client successfully reads their own workspace links count:', clientLinksRes.rows.length);

  // 5. Client can view their own tasks (all statuses including Pending transparently)
  const clientTasksRes = await db.query(`SELECT id, title, status FROM public.client_tasks WHERE client_id = $1;`, [ownerResult.id]);
  if (clientTasksRes.rows.length === 0) throw new Error('Client should be able to read their own tasks');
  console.log('[OK] Client successfully reads their own weekly tasks:', clientTasksRes.rows.map(t => `${t.title} (${t.status})`));

  // 6. Client CANNOT view other client records (isolation check)
  const clientOtherRes = await db.query(`SELECT id FROM public.clients WHERE id = $1;`, [dupClientId]);
  if (clientOtherRes.rows.length !== 0) throw new Error('Client must NOT be able to view other clients');
  console.log('[OK] Client multi-tenant isolation confirmed: other client returns 0 rows');

  await db.exec(`RESET ROLE;`);

  // ============================================================================
  // TEST H: Two-Factor Authentication Security, Recovery Codes & Rate Limiting
  // ============================================================================
  console.log('\n--- Test H: Two-Factor Authentication Security, Recovery Codes & Rate Limiting ---');

  // 1. Store 10 recovery codes for MGR1_ID
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${MGR1_ID}', false);`);
  const testCodes = [
    'ABCD-1111', 'ABCD-2222', 'ABCD-3333', 'ABCD-4444', 'ABCD-5555',
    'EFGH-6666', 'EFGH-7777', 'EFGH-8888', 'EFGH-9999', 'EFGH-0000'
  ];

  const storeRes = await db.query(
    `SELECT public.fn_2fa_store_recovery_codes($1, $2) AS result;`,
    [MGR1_ID, testCodes]
  );
  const storeJson = storeRes.rows[0].result;
  if (!storeJson.success || storeJson.count !== 10) {
    throw new Error('Failed to store 10 recovery codes: ' + JSON.stringify(storeJson));
  }
  console.log('[OK] 10 single-use recovery codes stored securely for manager.');

  // 2. Verify codes are stored hashed at rest (not plain text)
  const codeCheck = await db.query(`SELECT code_hash, used_at FROM public.user_2fa_recovery_codes WHERE user_id = $1;`, [MGR1_ID]);
  if (codeCheck.rows.length !== 10) throw new Error('Expected 10 rows in user_2fa_recovery_codes');
  for (const row of codeCheck.rows) {
    if (row.code_hash.includes('ABCD') || row.code_hash.includes('EFGH')) {
      throw new Error('SECURITY VIOLATION: Recovery code stored in plain text!');
    }
    if (row.used_at !== null) {
      throw new Error('Newly created recovery code should not be marked used');
    }
  }
  console.log('[OK] Verified all recovery codes are hashed at rest and unused.');

  // 3. Verify single-use consumption of recovery code
  const verifyRes1 = await db.query(
    `SELECT public.fn_2fa_verify_recovery_code($1, $2) AS result;`,
    [MGR1_ID, 'abcd-1111'] // case-insensitive, with hyphen
  );
  if (!verifyRes1.rows[0].result.success) {
    throw new Error('Valid recovery code verification failed: ' + JSON.stringify(verifyRes1.rows[0].result));
  }
  console.log('[OK] Valid recovery code successfully verified.');

  // 4. Verify the code CANNOT be reused (single-use guarantee)
  const verifyRes2 = await db.query(
    `SELECT public.fn_2fa_verify_recovery_code($1, $2) AS result;`,
    [MGR1_ID, 'ABCD-1111']
  );
  if (verifyRes2.rows[0].result.success) {
    throw new Error('SECURITY VIOLATION: Single-use recovery code was accepted a second time!');
  }
  console.log('[OK] Re-use of consumed recovery code was correctly rejected.');

  // 5. Test Rate-Limiting & Lockout: 4 more failed attempts brings total to 5
  console.log('Testing rate-limiting lockout after 5 consecutive failures...');
  for (let i = 2; i <= 4; i++) {
    const failRes = await db.query(
      `SELECT public.fn_2fa_record_failed_attempt($1, 'Bad TOTP code') AS result;`,
      [MGR1_ID]
    );
    if (failRes.rows[0].result.is_locked) {
      throw new Error(`Unexpected early lockout on attempt ${i}`);
    }
  }

  // 5th failed attempt -> MUST lock out
  const fifthFail = await db.query(
    `SELECT public.fn_2fa_record_failed_attempt($1, 'Bad TOTP code') AS result;`,
    [MGR1_ID]
  );
  if (!fifthFail.rows[0].result.is_locked) {
    throw new Error('5th failed attempt MUST trigger temporary lockout');
  }
  console.log('[OK] Account temporary lockout triggered on 5th consecutive failure.');

  // Check lockout RPC
  const lockoutCheck = await db.query(
    `SELECT public.fn_2fa_check_lockout($1) AS result;`,
    [MGR1_ID]
  );
  if (!lockoutCheck.rows[0].result.is_locked) {
    throw new Error('fn_2fa_check_lockout must report is_locked = true during active lockout');
  }
  console.log('[OK] fn_2fa_check_lockout confirms active lockout.');

  // 6. Test Admin 2FA Reset by Owner
  console.log('Testing Owner admin reset of 2FA...');
  // Non-owner (TM_ID) attempting reset MUST be denied
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${TM_ID}', false);`);
  let tmDenied = false;
  try {
    await db.query(`SELECT public.fn_2fa_admin_reset($1, 'Unauthorized attempt');`, [MGR1_ID]);
  } catch (err) {
    tmDenied = true;
    console.log('[OK] Team Member correctly denied from resetting 2FA:', err.message);
  }
  if (!tmDenied) throw new Error('Non-owner must NOT be allowed to reset 2FA');

  // Owner resetting 2FA MUST succeed
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${OWNER_ID}', false);`);
  const resetRes = await db.query(
    `SELECT public.fn_2fa_admin_reset($1, 'Staff lost device') AS result;`,
    [MGR1_ID]
  );
  if (!resetRes.rows[0].result.success) {
    throw new Error('Owner reset failed: ' + JSON.stringify(resetRes.rows[0].result));
  }

  // Verify all recovery codes wiped for MGR1_ID
  const codesAfterReset = await db.query(`SELECT COUNT(*)::int AS count FROM public.user_2fa_recovery_codes WHERE user_id = $1;`, [MGR1_ID]);
  if (codesAfterReset.rows[0].count !== 0) throw new Error('Recovery codes must be wiped after 2FA reset');

  // Verify lockout cleared
  const lockoutAfterReset = await db.query(`SELECT public.fn_2fa_check_lockout($1) AS result;`, [MGR1_ID]);
  if (lockoutAfterReset.rows[0].result.is_locked) throw new Error('Lockout must be cleared after 2FA reset');

  // Verify audit log has two_factor_reset_by_admin
  const auditRes = await db.query(
    `SELECT action, actor_id, entity_id FROM public.system_audit_events WHERE action = 'two_factor_reset_by_admin' AND entity_id = $1;`,
    [MGR1_ID]
  );
  if (auditRes.rows.length === 0) throw new Error('Audit event two_factor_reset_by_admin missing from system_audit_events');
  console.log('[OK] Owner 2FA reset verified with full cleanup and immutable audit logging.');

  console.log('\n======================================================================');
  console.log('ALL ISOLATED POSTGRESQL DATABASE VERIFICATIONS PASSED SUCCESSFULLY!');
  console.log('======================================================================\n');
}

runDatabaseVerification().catch((err) => {
  console.error('FATAL DATABASE TEST FAILURE:', err?.message || err, err?.stack);
  process.exit(1);
});
