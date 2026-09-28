-- 中港車預約平台 - 創建 public.users 表
-- 解決 auth.users 沒有對應 public.users 記錄的問題

-- 1. 創建 public.users 表
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('passenger', 'driver', 'admin')),
  phone TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 創建索引
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- 3. 同步現有 auth.users 到 public.users
INSERT INTO public.users (id, role, phone, name)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'role', 'passenger'),
  COALESCE(au.phone, au.raw_user_meta_data->>'phone', '未設置'),
  COALESCE(au.raw_user_meta_data->>'name', au.email, '用戶')
FROM auth.users au
ON CONFLICT (id) DO NOTHING;

-- 4. 創建/更新 handle_new_user 函數（自動同步）
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, role, phone, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'passenger'),
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone'),
    COALESCE(NEW.raw_user_meta_data->>'name', '乘客')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 創建觸發器
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 6. 啟用 RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 7. 公開可讀（用於顯示用戶名稱）
DROP POLICY IF EXISTS "Users are viewable by everyone" ON public.users;
CREATE POLICY "Users are viewable by everyone"
  ON public.users FOR SELECT
  USING (true);

-- 8. 用戶可更新自己的資料
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- 9. 用戶可插入自己的資料
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 10. 驗證結果
SELECT COUNT(*) as public_users_count FROM public.users;
SELECT COUNT(*) as auth_users_count FROM auth.users;

-- 完成！
