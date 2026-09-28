-- 補建缺失的 public.users 記錄
-- 針對已註冊但 public.users 表沒有對應記錄的用戶

-- 1. 先查詢現有 auth.users
SELECT id, email, raw_user_meta_data->>'role' as role,
       raw_user_meta_data->>'name' as name,
       raw_user_meta_data->>'phone' as phone
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.users);

-- 2. 為缺失的用戶補建記錄
INSERT INTO public.users (id, role, phone, name)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'role', 'passenger'),
  COALESCE(au.phone, au.raw_user_meta_data->>'phone'),
  COALESCE(au.raw_user_meta_data->>'name', '乘客')
FROM auth.users au
WHERE au.id NOT IN (SELECT id FROM public.users)
ON CONFLICT (id) DO NOTHING;

-- 3. 驗證結果
SELECT COUNT(*) as total_auth_users FROM auth.users;
SELECT COUNT(*) as total_public_users FROM public.users;
