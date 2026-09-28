-- 港中專車 - v1 釘釘搶單（司機池 + 訂單補欄位）
-- 創建時間: 2026-09-27
-- 說明:
--   1) 新增 drivers 表（釘釘註冊的司機池）
--   2) orders 表補 grabbed_by_driver_id / grabbed_at 欄位
--   3) drivers RLS：SELECT 公開；INSERT/UPDATE 限定 admin（service_role bypass）
--
-- 注意：本專案已啟用 service_role key 做後端 CRUD，
--       客戶端 anon key 不允許直接寫入 drivers 表

-- =========================================================
-- 1) 司機表（driver_pool）
-- =========================================================
CREATE TABLE IF NOT EXISTS public.drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dingtalk_staff_id text UNIQUE NOT NULL,
  name text NOT NULL,
  phone text NOT NULL,
  plate text NOT NULL,
  car_type text NOT NULL CHECK (car_type IN ('sedan_5', 'alphard_7', 'business_9')),
  driving_years integer NOT NULL DEFAULT 0 CHECK (driving_years >= 0 AND driving_years <= 50),
  seats integer NOT NULL CHECK (seats IN (5, 7, 9)),
  registered_at timestamptz NOT NULL DEFAULT now(),
  total_grabs integer NOT NULL DEFAULT 0,
  completed_orders integer NOT NULL DEFAULT 0,
  cancelled_orders integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drivers_staff_id ON public.drivers (dingtalk_staff_id);
CREATE INDEX IF NOT EXISTS idx_drivers_active ON public.drivers (active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_drivers_registered ON public.drivers (registered_at DESC);

COMMENT ON TABLE public.drivers IS 'v1 釘釘搶單司機池（透過 /driver/grab/[token] 註冊）';
COMMENT ON COLUMN public.drivers.dingtalk_staff_id IS '釘釘 userId（唯一）';
COMMENT ON COLUMN public.drivers.car_type IS 'sedan_5=5座豐田 / alphard_7=7座埃爾法 / business_9=9座商務';
COMMENT ON COLUMN public.drivers.seats IS '座位數 5 / 7 / 9';

-- updated_at 觸發器
DROP TRIGGER IF EXISTS trg_drivers_updated_at ON public.drivers;
CREATE TRIGGER trg_drivers_updated_at
  BEFORE UPDATE ON public.drivers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================================================
-- 2) 訂單表補欄位（搶單司機關聯）
-- =========================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS grabbed_by_driver_id uuid REFERENCES public.drivers(id),
  ADD COLUMN IF NOT EXISTS dingtalk_pushed_at timestamptz;

COMMENT ON COLUMN public.orders.grabbed_by_driver_id IS '搶單司機（關聯 drivers.id；舊流程使用 driver_id=users.id，保留不變）';
COMMENT ON COLUMN public.orders.dingtalk_pushed_at IS '釘釘 ActionCard 推送時間';

-- =========================================================
-- 3) drivers RLS：服務端才能寫，前端只能讀
-- =========================================================
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

-- 公開可查（顯示司機名/車牌用）
DROP POLICY IF EXISTS "drivers_select_all" ON public.drivers;
CREATE POLICY "drivers_select_all" ON public.drivers FOR SELECT USING (true);

-- 寫入限定 admin / service_role
DROP POLICY IF EXISTS "drivers_admin_all" ON public.drivers;
CREATE POLICY "drivers_admin_all" ON public.drivers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- =========================================================
-- 完成
-- =========================================================
-- 貼到 Supabase SQL Editor 執行即可。