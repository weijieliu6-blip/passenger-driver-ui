-- 訂單流程擴展：司機詳情表 + 訂單新字段
-- 執行方式：
-- 1. 登錄 Supabase Dashboard
-- 2. 進入 SQL Editor
-- 3. 複製粘貼本文件內容執行
-- 4. 或使用 psql: psql -f supabase/migrations/20260919_order_v3_driver_info.sql

BEGIN;

-- 1. 創建 driver_info 表（記錄司機詳細資料）
CREATE TABLE IF NOT EXISTS public.driver_info (
  id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  vehicle_plate TEXT NOT NULL,
  vehicle_model TEXT,
  driving_years INTEGER DEFAULT 0 CHECK (driving_years >= 0),
  total_orders INTEGER DEFAULT 0,
  total_rating_sum INTEGER DEFAULT 0,
  total_rating_count INTEGER DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 5.0 CHECK (rating >= 0 AND rating <= 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 為 orders 表添加新字段
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'driver_id') THEN
        ALTER TABLE orders ADD COLUMN driver_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON orders(driver_id);
        COMMENT ON COLUMN orders.driver_id IS '接單司機的用戶ID';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'confirmed_price') THEN
        ALTER TABLE orders ADD COLUMN confirmed_price DECIMAL(10,2) CHECK (confirmed_price >= 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'price_currency') THEN
        ALTER TABLE orders ADD COLUMN price_currency TEXT DEFAULT 'HKD' CHECK (price_currency IN ('HKD', 'CNY'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'price_confirmed_at') THEN
        ALTER TABLE orders ADD COLUMN price_confirmed_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'estimated_fare') THEN
        ALTER TABLE orders ADD COLUMN estimated_fare DECIMAL(10,2) CHECK (estimated_fare >= 0);
    END IF;
END $$;

-- 3. 擴展 order_status 枚舉
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'price_confirmed' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'order_status')
    ) THEN
        ALTER TYPE order_status ADD VALUE 'price_confirmed';
    END IF;
END $$;

-- 4. 啟用 driver_info RLS
ALTER TABLE public.driver_info ENABLE ROW LEVEL SECURITY;

-- 5. driver_info RLS 策略
DROP POLICY IF EXISTS "Driver info is viewable by everyone" ON public.driver_info;
CREATE POLICY "Driver info is viewable by everyone"
  ON public.driver_info FOR SELECT USING (true);

DROP POLICY IF EXISTS "Drivers can insert own info" ON public.driver_info;
CREATE POLICY "Drivers can insert own info"
  ON public.driver_info FOR INSERT
  WITH CHECK (
    auth.uid() = id AND
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'driver')
  );

DROP POLICY IF EXISTS "Drivers can update own info" ON public.driver_info;
CREATE POLICY "Drivers can update own info"
  ON public.driver_info FOR UPDATE
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 6. orders 表 RLS 擴展（司機可更新自己訂單的價格）
DROP POLICY IF EXISTS "Drivers can confirm price for own orders" ON public.orders;
CREATE POLICY "Drivers can confirm price for own orders"
  ON public.orders FOR UPDATE
  USING (
    driver_id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'driver')
  )
  WITH CHECK (driver_id = auth.uid());

-- 7. 評分更新觸發器
CREATE OR REPLACE FUNCTION update_driver_rating_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.rating IS NOT NULL AND OLD.rating IS NULL THEN
    UPDATE public.driver_info
    SET 
      total_orders = total_orders + 1,
      total_rating_sum = total_rating_sum + NEW.rating,
      total_rating_count = total_rating_count + 1,
      rating = ROUND((total_rating_sum + NEW.rating)::NUMERIC / (total_rating_count + 1), 2),
      updated_at = NOW()
    WHERE id = NEW.driver_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_driver_rating ON public.orders;
CREATE TRIGGER trigger_update_driver_rating
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION update_driver_rating_stats();

-- 8. 接單數更新觸發器
CREATE OR REPLACE FUNCTION update_driver_total_orders()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'grabbed' AND OLD.status = 'pending' AND NEW.driver_id IS NOT NULL THEN
    UPDATE public.driver_info
    SET total_orders = total_orders + 1, updated_at = NOW()
    WHERE id = NEW.driver_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_driver_total_orders ON public.orders;
CREATE TRIGGER trigger_update_driver_total_orders
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION update_driver_total_orders();

-- 9. 索引
CREATE INDEX IF NOT EXISTS idx_orders_price_confirmed_at ON orders(price_confirmed_at) WHERE price_confirmed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_driver_info_rating ON driver_info(rating DESC);

COMMIT;
