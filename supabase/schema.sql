-- 中港車預約平台 - Supabase 數據庫結構
-- 執行此 SQL 創建所有表和策略

-- 1. 創建 users 表（擴展 Supabase Auth）
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('passenger', 'driver', 'admin')),
  phone TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 創建 drivers_profile 表
CREATE TABLE IF NOT EXISTS public.drivers_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  membership_tier TEXT NOT NULL DEFAULT 'free' CHECK (membership_tier IN ('free', 'gold', 'diamond')),
  rating DECIMAL(3,2) DEFAULT 5.0 CHECK (rating >= 0 AND rating <= 5),
  vehicle_plate TEXT NOT NULL,
  vehicle_type TEXT NOT NULL,
  max_passengers INTEGER NOT NULL CHECK (max_passengers > 0),
  max_luggage INTEGER NOT NULL CHECK (max_luggage >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 創建 orders 表
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  pickup_location TEXT NOT NULL,
  dropoff_location TEXT NOT NULL,
  departure_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'completed', 'cancelled')),
  price_hkd DECIMAL(10,2) NOT NULL CHECK (price_hkd >= 0),
  driver_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  passenger_rating DECIMAL(3,2) DEFAULT 5.0 CHECK (passenger_rating >= 0 AND passenger_rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE
);

-- 4. 創建索引以優化查詢
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_drivers_profile_user_id ON public.drivers_profile(user_id);
CREATE INDEX IF NOT EXISTS idx_drivers_profile_membership ON public.drivers_profile(membership_tier);
CREATE INDEX IF NOT EXISTS idx_orders_passenger_id ON public.orders(passenger_id);
CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON public.orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

-- 5. 啟用 Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 6. users 表的 RLS 策略
-- 所有人可讀取基本用戶信息（用於顯示司機/乘客名稱）
CREATE POLICY "Users are viewable by everyone"
  ON public.users FOR SELECT
  USING (true);

-- 用戶只能更新自己的資料
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- 新用戶可插入自己的記錄
CREATE POLICY "Users can insert own profile"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 7. drivers_profile 表的 RLS 策略
-- 所有人可查看司機資料（用於顯示司機信息）
CREATE POLICY "Driver profiles are viewable by everyone"
  ON public.drivers_profile FOR SELECT
  USING (true);

-- 司機只能更新自己的資料（但不能改 membership_tier）
CREATE POLICY "Drivers can update own profile"
  ON public.drivers_profile FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id AND
    -- 防止司機自己修改會員等級
    membership_tier = (SELECT membership_tier FROM public.drivers_profile WHERE user_id = auth.uid())
  );

-- 司機可插入自己的資料
CREATE POLICY "Drivers can insert own profile"
  ON public.drivers_profile FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 管理員可以修改任何司機的會員等級
CREATE POLICY "Admins can update membership tier"
  ON public.drivers_profile FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 8. orders 表的 RLS 策略
-- 乘客可查看自己的訂單
CREATE POLICY "Passengers can view own orders"
  ON public.orders FOR SELECT
  USING (passenger_id = auth.uid());

-- 司機可查看所有 pending 訂單（前端根據會員等級過濾）
CREATE POLICY "Drivers can view pending orders"
  ON public.orders FOR SELECT
  USING (
    status = 'pending' AND
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'driver'
    )
  );

-- 司機可查看自己接的訂單
CREATE POLICY "Drivers can view accepted orders"
  ON public.orders FOR SELECT
  USING (driver_id = auth.uid());

-- 乘客可創建訂單
CREATE POLICY "Passengers can create orders"
  ON public.orders FOR INSERT
  WITH CHECK (
    passenger_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'passenger'
    )
  );

-- 司機可接單（更新 driver_id 和 status）
CREATE POLICY "Drivers can accept orders"
  ON public.orders FOR UPDATE
  USING (
    status = 'pending' AND
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'driver'
    )
  )
  WITH CHECK (
    driver_id = auth.uid() AND
    status = 'accepted'
  );

-- 司機可完成/取消自己的訂單
CREATE POLICY "Drivers can complete or cancel orders"
  ON public.orders FOR UPDATE
  USING (driver_id = auth.uid())
  WITH CHECK (status IN ('completed', 'cancelled'));

-- 乘客可取消自己的訂單
CREATE POLICY "Passengers can cancel own orders"
  ON public.orders FOR UPDATE
  USING (passenger_id = auth.uid() AND status = 'pending')
  WITH CHECK (status = 'cancelled');

-- 9. 創建函數：自動更新 accepted_at
CREATE OR REPLACE FUNCTION update_accepted_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    NEW.accepted_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_accepted_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION update_accepted_at();

-- 10. 創建函數：自動同步 auth.users 到 public.users
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, role, phone, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'passenger'),
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone'),
    COALESCE(NEW.raw_user_meta_data->>'name', '用戶')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- 11. 插入測試數據（可選）
-- 注意：實際使用時需要通過 Supabase Auth 註冊真實用戶
-- 以下僅為示例結構

-- 完成！
-- 執行以上 SQL 後，你的 Supabase 資料庫將完全配置好
