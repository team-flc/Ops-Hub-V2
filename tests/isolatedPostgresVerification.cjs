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

  // 4. Seed test profiles
  const OWNER_ID = '11111111-1111-1111-1111-111111111111';
  const MGR1_ID  = '22222222-2222-2222-2222-222222222222';
  const MGR2_ID  = '33333333-3333-3333-3333-333333333333';
  const TM_ID    = '44444444-4444-4444-4444-444444444444';

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
    { link_type: 'proposal_contract', url: 'https://docs.bizease.com/proposal-2026' }
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

  // Verify actual PostgreSQL rows
  const clientsInDb = await db.query(`SELECT * FROM public.clients WHERE id = $1;`, [ownerResult.id]);
  if (clientsInDb.rows.length !== 1) throw new Error('Client record not found in public.clients table');
  console.log('[OK] Owner client record confirmed in public.clients table.');

  const linksInDb = await db.query(`SELECT link_type, url FROM public.client_links WHERE client_id = $1 ORDER BY link_type;`, [ownerResult.id]);
  if (linksInDb.rows.length !== 3) throw new Error(`Expected 3 links in public.client_links, found ${linksInDb.rows.length}`);
  console.log('[OK] Reviews and Proposal/Contract links verified in public.client_links table:', linksInDb.rows);

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
       ($1, 'proposal_contract', 'https://docs.bizease.com/contract-clone', $2);`,
    [dupClientId, MGR1_ID]
  );

  const dupLinksCheck = await db.query(`SELECT link_type, url FROM public.client_links WHERE client_id = $1 ORDER BY link_type;`, [dupClientId]);
  if (dupLinksCheck.rows.length !== 2) throw new Error('Duplicate client links failed to insert');
  console.log('[OK] Duplicate client with Reviews and Proposal/Contract links verified in database:', dupLinksCheck.rows);

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

  console.log('[OK] Refreshed link retrieval confirmed:', refreshedMap);
  console.log('\n======================================================================');
  console.log('ALL ISOLATED POSTGRESQL DATABASE VERIFICATIONS PASSED SUCCESSFULLY!');
  console.log('======================================================================\n');
}

runDatabaseVerification().catch((err) => {
  console.error('FATAL DATABASE TEST FAILURE:', err?.message || err, err?.stack);
  process.exit(1);
});
