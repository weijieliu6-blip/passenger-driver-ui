-- 一鍵將指定 email 升級為 admin
--
-- 用法：
--   1) 把下方第 18 行 'YOUR_EMAIL_HERE' 改成真實 email（單引號內）
--   2) Supabase Dashboard → SQL Editor 貼上執行
--   3) 該用戶重新登入後即生效（Supabase 在每次登入時依 users.role
--      產生 JWT；現有 session 不會自動更新）
--
-- 安全：腳本會先檢查該 email 是否已存在；不存在的話**不**建立帳號，
-- 請先用 /passenger/login 註冊後再執行。

DO $$
DECLARE
  target_email TEXT := 'YOUR_EMAIL_HERE'; -- ← 改成你要升級的 email
  target_id UUID;
BEGIN
  SELECT id INTO target_id FROM auth.users WHERE email = target_email LIMIT 1;
  IF target_id IS NULL THEN
    RAISE EXCEPTION '找不到 email 為 % 的 auth.users，請先註冊', target_email;
  END IF;

  UPDATE public.users
  SET role = 'admin'
  WHERE id = target_id;

  RAISE NOTICE '✅ 已將 % (%) 升級為 admin', target_email, target_id;
END $$;

-- 確認結果
SELECT u.id, u.name, u.phone, u.role, au.email, u.created_at
FROM public.users u
JOIN auth.users au ON au.id = u.id
WHERE au.email = 'YOUR_EMAIL_HERE';
