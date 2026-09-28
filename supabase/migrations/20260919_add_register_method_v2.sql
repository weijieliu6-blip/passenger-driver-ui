-- 為 users 表添加 register_method 字段
-- 必須先執行此 SQL，然後才能使用手機號碼註冊功能
-- 否則 handle_new_user 觸發器會因為字段不存在而失敗

-- 1. 添加 register_method 字段
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS register_method TEXT DEFAULT 'email' CHECK (register_method IN ('email', 'phone'));

-- 2. 創建索引
CREATE INDEX IF NOT EXISTS idx_users_register_method ON public.users(register_method);

-- 3. 更新現有用戶的 register_method
UPDATE public.users u
SET register_method = 'phone'
FROM auth.users au
WHERE u.id = au.id
  AND au.email LIKE 'phone\_%@hkcar.app' ESCAPE '\';

-- 4. 更新 handle_new_user 觸發器（從 metadata 中讀取 register_method）
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, role, phone, name, register_method)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'passenger'),
    COALESCE(
      NEW.raw_user_meta_data->>'phone',
      NEW.phone,
      '00000000'
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

-- 驗證結果
SELECT 
  register_method,
  COUNT(*) as user_count
FROM public.users
GROUP BY register_method;

COMMENT ON COLUMN public.users.register_method IS '註冊方式：email（電郵）或 phone（手機號碼）';
