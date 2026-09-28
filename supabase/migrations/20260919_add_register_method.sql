-- 為 users 表添加 register_method 字段
-- 用於記錄用戶的註冊方式（email 或 phone）

-- 1. 添加 register_method 字段
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS register_method TEXT DEFAULT 'email' CHECK (register_method IN ('email', 'phone'));

-- 2. 創建索引（方便按註冊方式查詢）
CREATE INDEX IF NOT EXISTS idx_users_register_method ON public.users(register_method);

-- 完成！
COMMENT ON COLUMN public.users.register_method IS '註冊方式：email（電郵）或 phone（手機號碼）';
