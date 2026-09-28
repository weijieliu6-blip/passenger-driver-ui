-- 更新 handle_new_user 觸發器函數
-- 使其支持新的 register_method 字段

-- 刪除舊函數（如果存在）
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- 重新創建函數
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, role, phone, name, register_method)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'passenger'),
    COALESCE(
      NEW.raw_user_meta_data->>'phone',  -- 優先使用 metadata 中的電話
      NEW.phone,                          -- 否則使用 auth.users.phone
      '00000000'                          -- 最後備選（不應該出現這種情況）
    ),
    COALESCE(NEW.raw_user_meta_data->>'name', '乘客'),
    COALESCE(
      NEW.raw_user_meta_data->>'register_method',
      CASE 
        WHEN NEW.phone IS NOT NULL THEN 'phone'
        ELSE 'email'
      END
    )
  )
  ON CONFLICT (id) DO UPDATE SET
    phone = EXCLUDED.phone,
    register_method = EXCLUDED.register_method;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 確保觸發器存在
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 同步現有用戶的 register_method（根據他們的 email 格式推斷）
-- 電話註冊的用戶 email 格式為 phone_xxxxxxxx@hkcar.app
UPDATE public.users u
SET register_method = 'phone'
FROM auth.users au
WHERE u.id = au.id
  AND au.email LIKE 'phone\_%@hkcar.app' ESCAPE '\'
  AND u.register_method = 'email';

-- 完成！
SELECT 
  register_method,
  COUNT(*) as user_count
FROM public.users
GROUP BY register_method;
