-- ==============================================================================
-- Migration: 20261029000001_two_factor_authentication_totp_and_recovery.sql
-- Description: Two-Factor Authentication (2FA) TOTP, Single-Use Recovery Codes,
--              Rate-Limiting & Lockout, Owner Admin Reset, and Immutable Audit Logging.
-- ==============================================================================

-- 1. Single-Use Recovery Codes Table (Hashed at rest)
CREATE TABLE IF NOT EXISTS public.user_2fa_recovery_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  code_hash TEXT NOT NULL,
  used_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_2fa_recovery_codes_user_id 
  ON public.user_2fa_recovery_codes(user_id);

ALTER TABLE public.user_2fa_recovery_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_2fa_recovery_codes FROM anon, authenticated;

-- 2. 2FA Rate-Limiting & Lockout Table
CREATE TABLE IF NOT EXISTS public.user_2fa_attempts (
  user_id UUID PRIMARY KEY,
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ DEFAULT NULL,
  last_failed_at TIMESTAMPTZ DEFAULT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_2fa_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_2fa_attempts FROM anon, authenticated;

-- 3. Internal Failed Attempt & Lockout Helper (Max 5 attempts -> 15 min lockout)
CREATE OR REPLACE FUNCTION public.fn_2fa_record_failed_attempt_internal(
  p_user_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_new_attempts INT;
  v_lockout TIMESTAMPTZ := NULL;
  v_now TIMESTAMPTZ := NOW();
  v_actor_name TEXT;
  v_actor_role TEXT;
BEGIN
  SELECT COALESCE(full_name, 'System User'), COALESCE(role, 'authenticated')
  INTO v_actor_name, v_actor_role
  FROM public.profiles
  WHERE id = p_user_id;

  INSERT INTO public.user_2fa_attempts (user_id, failed_attempts, last_failed_at, updated_at)
  VALUES (p_user_id, 1, v_now, v_now)
  ON CONFLICT (user_id) DO UPDATE SET
    failed_attempts = CASE
      WHEN user_2fa_attempts.locked_until IS NOT NULL AND user_2fa_attempts.locked_until <= v_now THEN 1
      ELSE user_2fa_attempts.failed_attempts + 1
    END,
    last_failed_at = v_now,
    updated_at = v_now
  RETURNING failed_attempts INTO v_new_attempts;

  -- 5 failed attempts triggers 15 minute temporary lockout
  IF v_new_attempts >= 5 THEN
    v_lockout := v_now + INTERVAL '15 minutes';

    UPDATE public.user_2fa_attempts
    SET locked_until = v_lockout
    WHERE user_id = p_user_id;

    -- Immutable audit log for security lockout
    INSERT INTO public.system_audit_events (
      actor_id,
      actor_name,
      actor_role,
      action,
      entity_type,
      entity_id,
      reason,
      metadata
    ) VALUES (
      p_user_id,
      COALESCE(v_actor_name, 'System User'),
      COALESCE(v_actor_role, 'authenticated'),
      'two_factor_lockout',
      'security',
      p_user_id::text,
      'Account temporarily locked for 15 minutes due to 5 consecutive failed 2FA verification attempts',
      jsonb_build_object('user_id', p_user_id, 'lockout_until', v_lockout)
    );

    RETURN jsonb_build_object(
      'success', false,
      'is_locked', true,
      'error', 'Too many failed verification attempts. Your account is temporarily locked for 15 minutes.',
      'remaining_seconds', 900
    );
  END IF;

  -- Immutable audit log for failed attempt
  INSERT INTO public.system_audit_events (
    actor_id,
    actor_name,
    actor_role,
    action,
    entity_type,
    entity_id,
    reason,
    metadata
  ) VALUES (
    p_user_id,
    COALESCE(v_actor_name, 'System User'),
    COALESCE(v_actor_role, 'authenticated'),
    'two_factor_failed_attempt',
    'security',
    p_user_id::text,
    p_reason || ' (Attempt ' || v_new_attempts || ' of 5)',
    jsonb_build_object('user_id', p_user_id, 'attempt_count', v_new_attempts)
  );

  RETURN jsonb_build_object(
    'success', false,
    'is_locked', false,
    'error', 'Invalid verification code. Please check your authenticator app and try again.',
    'failed_attempts', v_new_attempts,
    'remaining_attempts', 5 - v_new_attempts
  );
END;
$$;

-- 4. Check Lockout Status RPC
CREATE OR REPLACE FUNCTION public.fn_2fa_check_lockout(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_attempts RECORD;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT * INTO v_attempts FROM public.user_2fa_attempts WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('is_locked', false, 'failed_attempts', 0);
  END IF;

  IF v_attempts.locked_until IS NOT NULL AND v_attempts.locked_until > v_now THEN
    RETURN jsonb_build_object(
      'is_locked', true,
      'remaining_seconds', CEIL(EXTRACT(EPOCH FROM (v_attempts.locked_until - v_now)))::int,
      'error', 'Account is temporarily locked due to multiple failed verification attempts. Please try again later.'
    );
  END IF;

  -- If lockout period expired, automatically reset
  IF v_attempts.locked_until IS NOT NULL AND v_attempts.locked_until <= v_now THEN
    UPDATE public.user_2fa_attempts
    SET failed_attempts = 0,
        locked_until = NULL,
        updated_at = v_now
    WHERE user_id = p_user_id;
  END IF;

  RETURN jsonb_build_object('is_locked', false, 'failed_attempts', v_attempts.failed_attempts);
END;
$$;

-- 5. Record External Failed TOTP Attempt RPC (called from login / verify)
CREATE OR REPLACE FUNCTION public.fn_2fa_record_failed_attempt(
  p_user_id UUID,
  p_reason TEXT DEFAULT 'Invalid authenticator code'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN public.fn_2fa_record_failed_attempt_internal(p_user_id, p_reason);
END;
$$;

-- 6. Record Successful 2FA Sign-in RPC
CREATE OR REPLACE FUNCTION public.fn_2fa_record_success(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor_name TEXT;
  v_actor_role TEXT;
BEGIN
  SELECT COALESCE(full_name, 'System User'), COALESCE(role, 'authenticated')
  INTO v_actor_name, v_actor_role
  FROM public.profiles
  WHERE id = p_user_id;

  UPDATE public.user_2fa_attempts
  SET failed_attempts = 0,
      locked_until = NULL,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  INSERT INTO public.system_audit_events (
    actor_id,
    actor_name,
    actor_role,
    action,
    entity_type,
    entity_id,
    reason
  ) VALUES (
    p_user_id,
    COALESCE(v_actor_name, 'System User'),
    COALESCE(v_actor_role, 'authenticated'),
    'two_factor_login_success',
    'security',
    p_user_id::text,
    'Two-factor authentication code verified successfully'
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 7. Store 10 Single-Use Recovery Codes RPC (Hashed with per-user salt at rest)
CREATE OR REPLACE FUNCTION public.fn_2fa_store_recovery_codes(
  p_user_id UUID,
  p_plain_codes TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_code TEXT;
  v_normalized TEXT;
  v_hash TEXT;
  v_actor_name TEXT;
  v_actor_role TEXT;
BEGIN
  IF v_caller IS NOT NULL AND v_caller <> p_user_id THEN
    RAISE EXCEPTION 'Access denied. You can only generate recovery codes for your own account.';
  END IF;

  IF p_plain_codes IS NULL OR array_length(p_plain_codes, 1) < 1 THEN
    RAISE EXCEPTION 'No recovery codes provided.';
  END IF;

  SELECT COALESCE(full_name, 'System User'), COALESCE(role, 'authenticated')
  INTO v_actor_name, v_actor_role
  FROM public.profiles
  WHERE id = p_user_id;

  -- Invalidate old codes
  DELETE FROM public.user_2fa_recovery_codes WHERE user_id = p_user_id;

  -- Store new hashed codes
  FOREACH v_code IN ARRAY p_plain_codes LOOP
    v_normalized := UPPER(REPLACE(TRIM(v_code), '-', ''));
    v_hash := encode(sha256((v_normalized || ':' || p_user_id::text)::bytea), 'hex');
    INSERT INTO public.user_2fa_recovery_codes (user_id, code_hash)
    VALUES (p_user_id, v_hash);
  END LOOP;

  -- Reset failed attempts on code generation
  INSERT INTO public.user_2fa_attempts (user_id, failed_attempts, locked_until, updated_at)
  VALUES (p_user_id, 0, NULL, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    failed_attempts = 0,
    locked_until = NULL,
    updated_at = NOW();

  INSERT INTO public.system_audit_events (
    actor_id,
    actor_name,
    actor_role,
    action,
    entity_type,
    entity_id,
    reason,
    metadata
  ) VALUES (
    p_user_id,
    COALESCE(v_actor_name, 'System User'),
    COALESCE(v_actor_role, 'authenticated'),
    'two_factor_recovery_codes_generated',
    'security',
    p_user_id::text,
    'Single-use recovery codes generated and stored securely',
    jsonb_build_object('count', array_length(p_plain_codes, 1))
  );

  RETURN jsonb_build_object('success', true, 'count', array_length(p_plain_codes, 1));
END;
$$;

-- 8. Verify and Consume Single-Use Recovery Code RPC
CREATE OR REPLACE FUNCTION public.fn_2fa_verify_recovery_code(
  p_user_id UUID,
  p_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_normalized TEXT;
  v_hash TEXT;
  v_matched_id UUID;
  v_attempts RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_actor_name TEXT;
  v_actor_role TEXT;
BEGIN
  -- Check Lockout
  SELECT * INTO v_attempts FROM public.user_2fa_attempts WHERE user_id = p_user_id;
  IF FOUND AND v_attempts.locked_until IS NOT NULL AND v_attempts.locked_until > v_now THEN
    RETURN jsonb_build_object(
      'success', false,
      'is_locked', true,
      'error', 'Account is temporarily locked due to multiple failed verification attempts. Please try again later.',
      'remaining_seconds', CEIL(EXTRACT(EPOCH FROM (v_attempts.locked_until - v_now)))::int
    );
  END IF;

  v_normalized := UPPER(REPLACE(TRIM(COALESCE(p_code, '')), '-', ''));
  IF length(v_normalized) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid verification code.');
  END IF;

  v_hash := encode(sha256((v_normalized || ':' || p_user_id::text)::bytea), 'hex');

  -- Search unused recovery code
  SELECT id INTO v_matched_id
  FROM public.user_2fa_recovery_codes
  WHERE user_id = p_user_id
    AND code_hash = v_hash
    AND used_at IS NULL
  LIMIT 1;

  IF v_matched_id IS NOT NULL THEN
    -- Mark code as used (single-use enforcement)
    UPDATE public.user_2fa_recovery_codes
    SET used_at = v_now
    WHERE id = v_matched_id;

    -- Reset failed attempts
    INSERT INTO public.user_2fa_attempts (user_id, failed_attempts, locked_until, updated_at)
    VALUES (p_user_id, 0, NULL, v_now)
    ON CONFLICT (user_id) DO UPDATE SET
      failed_attempts = 0,
      locked_until = NULL,
      updated_at = v_now;

    SELECT COALESCE(full_name, 'System User'), COALESCE(role, 'authenticated')
    INTO v_actor_name, v_actor_role
    FROM public.profiles
    WHERE id = p_user_id;

    INSERT INTO public.system_audit_events (
      actor_id,
      actor_name,
      actor_role,
      action,
      entity_type,
      entity_id,
      reason
    ) VALUES (
      p_user_id,
      COALESCE(v_actor_name, 'System User'),
      COALESCE(v_actor_role, 'authenticated'),
      'two_factor_recovery_code_used',
      'security',
      p_user_id::text,
      'Single-use recovery code verified successfully'
    );

    RETURN jsonb_build_object('success', true);
  ELSE
    RETURN public.fn_2fa_record_failed_attempt_internal(p_user_id, 'Invalid recovery code attempt');
  END IF;
END;
$$;

-- 9. Get 2FA Status RPC (checks verified factor and remaining recovery codes)
CREATE OR REPLACE FUNCTION public.fn_2fa_get_status(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_caller_role TEXT;
  v_has_factor BOOLEAN := FALSE;
  v_factor_id TEXT := NULL;
  v_remaining_codes INT := 0;
BEGIN
  -- Access Control: user themselves or Owner
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller;
  IF v_caller IS NOT NULL AND (v_caller <> p_user_id AND v_caller_role <> 'owner') THEN
    RAISE EXCEPTION 'Access denied.';
  END IF;

  -- Inspect auth.mfa_factors for verified TOTP
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'mfa_factors') THEN
    SELECT id::text INTO v_factor_id
    FROM auth.mfa_factors
    WHERE user_id = p_user_id
      AND status = 'verified'
      AND factor_type = 'totp'
    LIMIT 1;

    IF v_factor_id IS NOT NULL THEN
      v_has_factor := TRUE;
    END IF;
  END IF;

  -- Count remaining recovery codes
  SELECT COUNT(*)::int INTO v_remaining_codes
  FROM public.user_2fa_recovery_codes
  WHERE user_id = p_user_id
    AND used_at IS NULL;

  RETURN jsonb_build_object(
    'is_enabled', v_has_factor,
    'factor_id', v_factor_id,
    'remaining_recovery_codes', v_remaining_codes
  );
END;
$$;

-- 10. Disable 2FA RPC (Called when user disables 2FA with password & current code)
CREATE OR REPLACE FUNCTION public.fn_2fa_disable(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_actor_name TEXT;
  v_actor_role TEXT;
BEGIN
  IF v_caller IS NOT NULL AND v_caller <> p_user_id THEN
    RAISE EXCEPTION 'Access denied. You can only disable 2FA for your own account.';
  END IF;

  SELECT COALESCE(full_name, 'System User'), COALESCE(role, 'authenticated')
  INTO v_actor_name, v_actor_role
  FROM public.profiles
  WHERE id = p_user_id;

  -- Delete all recovery codes and rate-limiting attempts
  DELETE FROM public.user_2fa_recovery_codes WHERE user_id = p_user_id;
  DELETE FROM public.user_2fa_attempts WHERE user_id = p_user_id;

  -- Delete MFA factors if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'mfa_factors') THEN
    DELETE FROM auth.mfa_challenges
    WHERE factor_id IN (SELECT id FROM auth.mfa_factors WHERE user_id = p_user_id);

    DELETE FROM auth.mfa_factors
    WHERE user_id = p_user_id;
  END IF;

  INSERT INTO public.system_audit_events (
    actor_id,
    actor_name,
    actor_role,
    action,
    entity_type,
    entity_id,
    reason
  ) VALUES (
    p_user_id,
    COALESCE(v_actor_name, 'System User'),
    COALESCE(v_actor_role, 'authenticated'),
    'two_factor_disabled',
    'security',
    p_user_id::text,
    'Two-Factor Authentication disabled by user'
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 11. Admin Emergency Reset 2FA RPC (Strictly restricted to Owners)
CREATE OR REPLACE FUNCTION public.fn_2fa_admin_reset(
  p_target_user_id UUID,
  p_reason TEXT DEFAULT 'Owner emergency 2FA reset'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_caller_role TEXT;
  v_caller_name TEXT;
  v_target_name TEXT;
BEGIN
  -- Strict Authorization: Only 'owner' role can reset 2FA
  SELECT role, full_name INTO v_caller_role, v_caller_name
  FROM public.profiles
  WHERE id = v_caller;

  IF v_caller IS NOT NULL AND (v_caller_role IS NULL OR v_caller_role <> 'owner') THEN
    RAISE EXCEPTION 'Access denied. Only Owners can reset Two-Factor Authentication.';
  END IF;

  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Target user ID is required.';
  END IF;

  SELECT full_name INTO v_target_name
  FROM public.profiles
  WHERE id = p_target_user_id;

  -- 1. Remove MFA factors and challenges in auth schema
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'mfa_factors') THEN
    DELETE FROM auth.mfa_challenges
    WHERE factor_id IN (SELECT id FROM auth.mfa_factors WHERE user_id = p_target_user_id);

    DELETE FROM auth.mfa_factors
    WHERE user_id = p_target_user_id;
  END IF;

  -- 2. Remove recovery codes and lockout attempts
  DELETE FROM public.user_2fa_recovery_codes WHERE user_id = p_target_user_id;
  DELETE FROM public.user_2fa_attempts WHERE user_id = p_target_user_id;

  -- 3. Log authoritative audit event
  INSERT INTO public.system_audit_events (
    actor_id,
    actor_name,
    actor_role,
    action,
    entity_type,
    entity_id,
    reason,
    metadata
  ) VALUES (
    v_caller,
    COALESCE(v_caller_name, 'Owner / System Admin'),
    COALESCE(v_caller_role, 'owner'),
    'two_factor_reset_by_admin',
    'security',
    p_target_user_id::text,
    COALESCE(p_reason, 'Owner emergency 2FA reset'),
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'target_user_name', COALESCE(v_target_name, 'Staff Member'),
      'reset_by_owner_id', v_caller
    )
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 12. Log 2FA General Security Event RPC
CREATE OR REPLACE FUNCTION public.fn_2fa_log_event(
  p_user_id UUID,
  p_action TEXT,
  p_reason TEXT,
  p_metadata JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor_name TEXT;
  v_actor_role TEXT;
BEGIN
  SELECT COALESCE(full_name, 'System User'), COALESCE(role, 'authenticated')
  INTO v_actor_name, v_actor_role
  FROM public.profiles
  WHERE id = p_user_id;

  INSERT INTO public.system_audit_events (
    actor_id,
    actor_name,
    actor_role,
    action,
    entity_type,
    entity_id,
    reason,
    metadata
  ) VALUES (
    p_user_id,
    COALESCE(v_actor_name, 'System User'),
    COALESCE(v_actor_role, 'authenticated'),
    p_action,
    'security',
    p_user_id::text,
    p_reason,
    p_metadata
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 13. Grant Execute Permissions
GRANT EXECUTE ON FUNCTION public.fn_2fa_check_lockout TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_2fa_record_failed_attempt TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_2fa_verify_recovery_code TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_2fa_record_success TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_2fa_store_recovery_codes TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_2fa_get_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_2fa_disable TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_2fa_admin_reset TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_2fa_log_event TO authenticated;
