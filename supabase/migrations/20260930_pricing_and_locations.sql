-- 2026-09-30 — Pricing + Locations + Order 擴充
-- 創建時間: 2026-09-30
-- 範圍：
--   1. pricing_rules：港粵熱門路線估算價（7座 / 4座）
--   2. locations：內建 POI（機場、口岸、商場、飯店、車站）
--   3. orders 擴充 pickup_address / dropoff_address（細節地址）+ lat/lng

-- ============================================================
-- 1. pricing_rules
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pricing_rules (
  id BIGSERIAL PRIMARY KEY,
  from_zone TEXT NOT NULL,         -- 起點 zone code（例 'hk_central'）
  to_zone TEXT NOT NULL,           -- 終點 zone code
  vehicle_type TEXT NOT NULL,      -- '4_seat' | '7_seat'
  base_price NUMERIC(10,2) NOT NULL,    -- 基礎價 HKD
  currency TEXT NOT NULL DEFAULT 'HKD',
  night_surcharge NUMERIC(10,2) NOT NULL DEFAULT 0,  -- 22:00-07:00 加成
  estimated_minutes INT,           -- 預估車程分鐘
  notes TEXT,                      -- 備註（例「港島加 $100 過海費」）
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 唯一索引（避免重複規則）
CREATE UNIQUE INDEX IF NOT EXISTS idx_pricing_rules_unique
  ON public.pricing_rules (from_zone, to_zone, vehicle_type);

-- 索引：查詢常用
CREATE INDEX IF NOT EXISTS idx_pricing_rules_zones
  ON public.pricing_rules (from_zone, to_zone);

COMMENT ON TABLE public.pricing_rules IS '港粵熱門路線價格估算表（後台可調整）';

-- ============================================================
-- 2. locations
-- ============================================================
CREATE TABLE IF NOT EXISTS public.locations (
  id BIGSERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,       -- 短代碼（例 'hkg_airport', 'sz_futian_port'）
  name_zh TEXT NOT NULL,
  name_en TEXT,
  region TEXT NOT NULL,            -- 'hk' | 'mainland'
  category TEXT NOT NULL,          -- 'airport' | 'port' | 'mall' | 'hotel' | 'station' | 'landmark' | 'residential'
  zone_code TEXT NOT NULL,         -- 對應 pricing_rules 的 from_zone/to_zone
  address_zh TEXT,                 -- 預設詳細地址
  lat NUMERIC(10,6),
  lng NUMERIC(10,6),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 全文搜尋（中文 + 英文）
CREATE INDEX IF NOT EXISTS idx_locations_name_zh ON public.locations USING gin (to_tsvector('simple', name_zh));
CREATE INDEX IF NOT EXISTS idx_locations_name_en ON public.locations USING gin (to_tsvector('simple', coalesce(name_en, '')));
CREATE INDEX IF NOT EXISTS idx_locations_region_category ON public.locations (region, category);

COMMENT ON TABLE public.locations IS '內建熱門地點 POI 表（支援搜尋、手動輸入補充）';

-- ============================================================
-- 3. orders 擴充：pickup_address / dropoff_address + lat/lng
-- ============================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pickup_address TEXT,         -- 詳細上車地址（街道、門牌）
  ADD COLUMN IF NOT EXISTS dropoff_address TEXT,
  ADD COLUMN IF NOT EXISTS pickup_lat NUMERIC(10,6),
  ADD COLUMN IF NOT EXISTS pickup_lng NUMERIC(10,6),
  ADD COLUMN IF NOT EXISTS dropoff_lat NUMERIC(10,6),
  ADD COLUMN IF NOT EXISTS dropoff_lng NUMERIC(10,6),
  ADD COLUMN IF NOT EXISTS estimated_fare NUMERIC(10,2);  -- 系統估算價 HKD

COMMENT ON COLUMN public.orders.pickup_address IS '上車詳細地址（街道、門牌號）';
COMMENT ON COLUMN public.orders.dropoff_address IS '下車詳細地址';
COMMENT ON COLUMN public.orders.estimated_fare IS '系統估算車資（HKD，僅供司機參考，最終由司機報價）';

-- ============================================================
-- Pricing RPC：被 orders/create 等 route 呼叫
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_pricing_estimate(
  p_pickup_zone TEXT,
  p_dropoff_zone TEXT,
  p_vehicle_type TEXT,
  p_departure_time TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  rule pricing_rules%ROWTYPE;
  night_hour INT;
  base_price NUMERIC(10,2);
  night_surcharge NUMERIC(10,2);
  total_price NUMERIC(10,2);
  hk_time TIMESTAMPTZ;
BEGIN
  -- 嘗試雙向：A→B 與 B→A
  SELECT * INTO rule FROM pricing_rules
    WHERE from_zone = p_pickup_zone
      AND to_zone = p_dropoff_zone
      AND vehicle_type = p_vehicle_type
      AND active = true
    LIMIT 1;

  IF NOT FOUND THEN
    SELECT * INTO rule FROM pricing_rules
      WHERE from_zone = p_dropoff_zone
        AND to_zone = p_pickup_zone
        AND vehicle_type = p_vehicle_type
        AND active = true
      LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'found', false,
      'message', '此路線暫無標準報價'
    );
  END IF;

  base_price := rule.base_price;
  night_surcharge := 0;

  -- 夜間加成：HK 時間 22:00-07:00
  IF p_departure_time IS NOT NULL THEN
    hk_time := p_departure_time AT TIME ZONE 'Asia/Hong_Kong';
    night_hour := EXTRACT(HOUR FROM hk_time)::INT;
    IF night_hour >= 22 OR night_hour < 7 THEN
      night_surcharge := COALESCE(rule.night_surcharge, 0);
    END IF;
  END IF;

  total_price := base_price + night_surcharge;

  RETURN jsonb_build_object(
    'found', true,
    'base_price', base_price,
    'night_surcharge', night_surcharge,
    'total_price', total_price,
    'currency', COALESCE(rule.currency, 'HKD'),
    'estimated_minutes', rule.estimated_minutes,
    'notes', rule.notes,
    'rule_id', rule.id
  );
END;
$$;

-- ============================================================
-- RLS：locations 所有人可讀；pricing_rules 所有人可讀
-- ============================================================
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "locations_read_all" ON public.locations;
CREATE POLICY "locations_read_all" ON public.locations
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "pricing_rules_read_all" ON public.pricing_rules;
CREATE POLICY "pricing_rules_read_all" ON public.pricing_rules
  FOR SELECT USING (true);

-- admin 可寫（透過 service role 也可繞過）
DROP POLICY IF EXISTS "locations_admin_write" ON public.locations;
CREATE POLICY "locations_admin_write" ON public.locations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "pricing_rules_admin_write" ON public.pricing_rules;
CREATE POLICY "pricing_rules_admin_write" ON public.pricing_rules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );