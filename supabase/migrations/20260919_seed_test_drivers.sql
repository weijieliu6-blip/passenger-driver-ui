-- 創建測試司機到 auth.users + users + driver_info
-- 一次性生成 4 個測試司機（gold/platinum/normal/none）

-- 1. 創建 auth.users 帳號（密碼統一為 test123456）
-- 用 gen_random_uuid() 自動生成 UUID

-- 司機 1：金牌會員
DO $$
DECLARE
  uid_gold UUID := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, phone,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token,
    email_change, email_change_token_new, recovery_token
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    uid_gold,
    'authenticated', 'authenticated',
    'test_driver_gold@test.com', '+85290000001',
    crypt('test123456', gen_salt('bf')), NOW(),
    '{"provider":"phone","providers":["phone"]}',
    '{"role":"driver","name":"測試司機-金牌"}',
    NOW(), NOW(), '',
    '', '', ''
  )
  ON CONFLICT (phone) DO NOTHING;

  INSERT INTO public.users (id, role, phone, name)
  VALUES (uid_gold, 'driver', '+85290000001', '測試司機-金牌')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.driver_info (id, vehicle_plate, vehicle_model, membership_tier, rating, driving_years, total_orders)
  VALUES (uid_gold, 'TEST-GOLD', 'Toyota Alphard', 'gold', 5.0, 5, 0)
  ON CONFLICT (id) DO UPDATE SET membership_tier = 'gold';

  RAISE NOTICE '✅ 金牌司機已建立 (電話 +85290000001)';
END $$;

-- 司機 2：白金會員
DO $$
DECLARE
  uid_platinum UUID := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, phone,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token,
    email_change, email_change_token_new, recovery_token
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    uid_platinum,
    'authenticated', 'authenticated',
    'test_driver_platinum@test.com', '+85290000002',
    crypt('test123456', gen_salt('bf')), NOW(),
    '{"provider":"phone","providers":["phone"]}',
    '{"role":"driver","name":"測試司機-白金"}',
    NOW(), NOW(), '',
    '', '', ''
  )
  ON CONFLICT (phone) DO NOTHING;

  INSERT INTO public.users (id, role, phone, name)
  VALUES (uid_platinum, 'driver', '+85290000002', '測試司機-白金')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.driver_info (id, vehicle_plate, vehicle_model, membership_tier, rating, driving_years, total_orders)
  VALUES (uid_platinum, 'TEST-PLAT', 'Toyota Alphard', 'platinum', 4.8, 3, 0)
  ON CONFLICT (id) DO UPDATE SET membership_tier = 'platinum';

  RAISE NOTICE '✅ 白金司機已建立 (電話 +85290000002)';
END $$;

-- 司機 3：普通會員
DO $$
DECLARE
  uid_normal UUID := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, phone,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token,
    email_change, email_change_token_new, recovery_token
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    uid_normal,
    'authenticated', 'authenticated',
    'test_driver_normal@test.com', '+85290000003',
    crypt('test123456', gen_salt('bf')), NOW(),
    '{"provider":"phone","providers":["phone"]}',
    '{"role":"driver","name":"測試司機-普通"}',
    NOW(), NOW(), '',
    '', '', ''
  )
  ON CONFLICT (phone) DO NOTHING;

  INSERT INTO public.users (id, role, phone, name)
  VALUES (uid_normal, 'driver', '+85290000003', '測試司機-普通')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.driver_info (id, vehicle_plate, vehicle_model, membership_tier, rating, driving_years, total_orders)
  VALUES (uid_normal, 'TEST-NORM', 'Toyota Alphard', 'normal', 4.5, 1, 0)
  ON CONFLICT (id) DO UPDATE SET membership_tier = 'normal';

  RAISE NOTICE '✅ 普通司機已建立 (電話 +85290000003)';
END $$;

-- 司機 4：非會員
DO $$
DECLARE
  uid_none UUID := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, phone,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token,
    email_change, email_change_token_new, recovery_token
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    uid_none,
    'authenticated', 'authenticated',
    'test_driver_none@test.com', '+85290000004',
    crypt('test123456', gen_salt('bf')), NOW(),
    '{"provider":"phone","providers":["phone"]}',
    '{"role":"driver","name":"測試司機-非會員"}',
    NOW(), NOW(), '',
    '', '', ''
  )
  ON CONFLICT (phone) DO NOTHING;

  INSERT INTO public.users (id, role, phone, name)
  VALUES (uid_none, 'driver', '+85290000004', '測試司機-非會員')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.driver_info (id, vehicle_plate, vehicle_model, membership_tier, rating, driving_years, total_orders)
  VALUES (uid_none, 'TEST-NONE', 'Toyota Alphard', 'none', 4.0, 0, 0)
  ON CONFLICT (id) DO UPDATE SET membership_tier = 'none';

  RAISE NOTICE '✅ 非會員司機已建立 (電話 +85290000004)';
END $$;

-- 驗證：列出所有測試司機
SELECT
  u.name,
  u.phone,
  d.vehicle_plate,
  d.membership_tier,
  d.rating
FROM users u
JOIN driver_info d ON u.id = d.id
WHERE u.role = 'driver'
ORDER BY
  CASE d.membership_tier
    WHEN 'gold' THEN 1
    WHEN 'platinum' THEN 2
    WHEN 'normal' THEN 3
    WHEN 'none' THEN 4
    ELSE 5
  END;
