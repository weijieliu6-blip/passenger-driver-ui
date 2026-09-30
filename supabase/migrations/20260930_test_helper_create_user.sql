-- 2026-09-30 — 一次性 dev helper：create_auth_user (僅限 service_role)
-- 用途：admin API 故障時，測試腳本可以呼叫此 RPC 建立用戶
CREATE OR REPLACE FUNCTION public.create_auth_user(
  p_email TEXT,
  p_password TEXT,
  p_role TEXT DEFAULT 'passenger',
  p_name TEXT DEFAULT 'Test User',
  p_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
  v_meta JSONB;
BEGIN
  -- 已存在則返回 id
  SELECT id INTO v_id FROM auth.users WHERE email = p_email;
  IF v_id IS NOT NULL THEN
    RETURN jsonb_build_object('id', v_id, 'existing', true);
  END IF;

  v_id := gen_random_uuid();
  v_meta := jsonb_build_object(
    'role', p_role, 'name', p_name, 'register_method', 'email',
    'phone', COALESCE(p_phone, '+85290000000')
  );

  INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_id,
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    v_meta,
    now(), now(), '', '', '', ''
  );

  -- trigger handle_new_user 會自動建 users 記錄
  RETURN jsonb_build_object('id', v_id, 'existing', false);
END;
$$;

REVOKE ALL ON FUNCTION public.create_auth_user FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_auth_user TO service_role;