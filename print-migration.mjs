// 用一個簡單的 patch：先關閉觸發器，再用 service role 手動處理
// 實際上我們需要用戶在 Supabase Dashboard 中執行 SQL

// 讓我創建一個簡單的 migration 文件給用戶執行
console.log('請在 Supabase Dashboard 執行以下 SQL:')
console.log('========================================')
console.log(`
-- 為 users 表添加 register_method 字段
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS register_method TEXT DEFAULT 'email' 
CHECK (register_method IN ('email', 'phone'));

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_users_register_method 
ON public.users(register_method);

-- 更新 handle_new_user 觸發器（從 metadata 讀取 register_method）
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

-- 同步現有用戶的 register_method
UPDATE public.users u
SET register_method = 'phone'
FROM auth.users au
WHERE u.id = au.id
  AND au.email LIKE 'phone_%@hkcar.app';
`)
