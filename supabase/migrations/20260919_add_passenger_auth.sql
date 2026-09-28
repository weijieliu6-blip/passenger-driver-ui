-- 中港車預約平台 - 乘客註冊功能
-- 此腳本用於為乘客端添加完整的註冊/登入系統

-- 1. 添加 passenger_id 字段到 orders 表（綁定訂單到乘客帳號）
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS passenger_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 為 passenger_id 創建索引
CREATE INDEX IF NOT EXISTS idx_orders_passenger_id ON public.orders(passenger_id);

-- 2. 放寬 orders 表的 RLS 策略
-- 允許已登入乘客查看自己的訂單（無論是否為 pending/grabbed/completed/cancelled）
DROP POLICY IF EXISTS "Passengers can view own orders" ON public.orders;
CREATE POLICY "Passengers can view own orders"
  ON public.orders FOR SELECT
  USING (passenger_id = auth.uid());

-- 乘客可創建訂單（需綁定到自己的帳號）
DROP POLICY IF EXISTS "Passengers can create orders" ON public.orders;
CREATE POLICY "Passengers can create orders"
  ON public.orders FOR INSERT
  WITH CHECK (
    passenger_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'passenger'
    )
  );

-- 乘客可取消自己的訂單
DROP POLICY IF EXISTS "Passengers can cancel own orders" ON public.orders;
CREATE POLICY "Passengers can cancel own orders"
  ON public.orders FOR UPDATE
  USING (passenger_id = auth.uid() AND status = 'pending')
  WITH CHECK (status = 'cancelled');

-- 3. 放寬 users 表的 RLS 策略（允許服務端 API 創建用戶記錄）
-- 用戶可查看自己的資料
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id OR true); -- 公開可讀（用於顯示名稱）

-- 用戶可更新自己的資料
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- 用戶可插入自己的記錄（首次註冊時觸發）
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 4. 創建/更新 handle_new_user 觸發器（確保新註冊用戶自動同步到 public.users）
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
  ON CONFLICT (id) DO NOTHING; -- 避免重複插入
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 確保觸發器存在
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 5. 啟用 Supabase Auth 的 Email 註冊（默認已啟用）
-- 注意：Supabase Auth 默認啟用 email 註冊，無需額外配置

-- 完成！
-- 執行後乘客可以通過 /passenger/login 頁面註冊/登入
