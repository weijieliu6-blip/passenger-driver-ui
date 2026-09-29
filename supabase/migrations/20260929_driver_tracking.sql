-- 司機即時位置 + 行程事件審計
-- 創建時間: 2026-09-29

-- 1) 司機即時位置（每個司機最多一筆，由 client upsert）
CREATE TABLE IF NOT EXISTS public.driver_locations (
  driver_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  heading real,                 -- 方向角 0-360 度（可選）
  speed real,                   -- m/s
  accuracy real,                -- 定位精度（公尺）
  order_number text,            -- 司機正在執行的訂單（可空：例如空閒中）
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_locations_order ON public.driver_locations (order_number) WHERE order_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_driver_locations_updated ON public.driver_locations (updated_at DESC);

COMMENT ON TABLE public.driver_locations IS '司機即時位置：行車中每 15s 由 client 上報一次';
COMMENT ON COLUMN public.driver_locations.heading IS '行進方向角（度）';
COMMENT ON COLUMN public.driver_locations.order_number IS '當前正在執行的訂單（綁定後乘客端可訂閱）';

-- 2) 訂單狀態/事件流水（審計 + 乘客端訊息）
CREATE TABLE IF NOT EXISTS public.ride_events (
  id bigserial PRIMARY KEY,
  order_number text NOT NULL,
  actor_role text NOT NULL CHECK (actor_role IN ('passenger','driver','system')),
  event_type text NOT NULL,     -- status_changed / message / location_ping
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ride_events_order ON public.ride_events (order_number, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ride_events_type ON public.ride_events (event_type);

COMMENT ON TABLE public.ride_events IS '訂單事件流水（狀態切換/司機訊息）';

-- 3) orders.driver_id 索引（用於即時查詢司機最新位置）
CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON public.orders (driver_id) WHERE driver_id IS NOT NULL;

-- 4) RLS
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_events ENABLE ROW LEVEL SECURITY;

-- 司機可寫自己的位置；任何人（包含匿名乘客）只能讀取由 service_role 提供的視圖
-- 為簡化：寫入走 service_role，客戶端透過 API 路由；對 anon 也只開放 insert 用於回報（需後續可改）
DROP POLICY IF EXISTS "driver_locations_select_all" ON public.driver_locations;
CREATE POLICY "driver_locations_select_all" ON public.driver_locations FOR SELECT USING (true);

DROP POLICY IF EXISTS "ride_events_select_all" ON public.ride_events;
CREATE POLICY "ride_events_select_all" ON public.ride_events FOR SELECT USING (true);

-- 5) Realtime：把 driver_locations / ride_events 加入 supabase_realtime publication
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations';
    EXCEPTION WHEN duplicate_object THEN NULL;
              WHEN undefined_object THEN NULL;
    END;
    BEGIN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_events';
    EXCEPTION WHEN duplicate_object THEN NULL;
              WHEN undefined_object THEN NULL;
    END;
  END IF;
END$$;
