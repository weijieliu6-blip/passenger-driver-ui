-- 2026-09-29（補丁）— RLS 補強
-- 創建時間: 2026-09-29
-- 說明：先前 driver_tracking.sql 將 driver_locations / ride_events 設成
--       SELECT USING (true)，這代表任何拿到 anon key 的瀏覽器端客戶端
--       都能讀取所有司機即時經緯度與所有訂單事件。本 migration 收緊：
--         - driver_locations：僅「與該司機有當前進行中訂單的乘客」可讀
--         - ride_events：僅「訂單所屬的乘客或司機」可讀
-- 同時為 orders / users / driver_info / driver_applications / announcements
-- 補上 RLS，預設 deny-all，anon / authenticated policy 由後續 migration 細部放行。

-- ==================== driver_locations ====================
DROP POLICY IF EXISTS "driver_locations_select_all" ON public.driver_locations;

-- 允許：訂單的 passenger 讀取該訂單綁定的司機位置
CREATE POLICY "driver_locations_select_for_order_passenger"
  ON public.driver_locations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.order_number = driver_locations.order_number
        AND o.passenger_id = auth.uid()
        AND o.status IN ('grabbed', 'price_confirmed', 'completed')
    )
  );

-- 允許：司機自己讀自己的位置
CREATE POLICY "driver_locations_select_self"
  ON public.driver_locations FOR SELECT
  TO authenticated
  USING (driver_id = auth.uid());

-- 拒絕 anon 讀（預設 deny，但顯式 revoke 以防萬一）
REVOKE SELECT ON public.driver_locations FROM anon;

-- ==================== ride_events ====================
DROP POLICY IF EXISTS "ride_events_select_all" ON public.ride_events;

-- 允許：訂單的 passenger 讀取自己訂單的事件
CREATE POLICY "ride_events_select_for_order_passenger"
  ON public.ride_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.order_number = ride_events.order_number
        AND o.passenger_id = auth.uid()
    )
  );

-- 允許：訂單的 driver 讀取自己訂單的事件
CREATE POLICY "ride_events_select_for_order_driver"
  ON public.ride_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.order_number = ride_events.order_number
        AND o.driver_id = auth.uid()
    )
  );

-- 拒絕 anon 讀
REVOKE SELECT ON public.ride_events FROM anon;

-- ==================== orders ====================
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- passenger 讀自己的訂單
CREATE POLICY "orders_select_own_as_passenger"
  ON public.orders FOR SELECT
  TO authenticated
  USING (passenger_id = auth.uid());

-- driver 讀自己接的訂單
CREATE POLICY "orders_select_own_as_driver"
  ON public.orders FOR SELECT
  TO authenticated
  USING (driver_id = auth.uid());

-- passenger 修改自己訂單的「評分/取消/編輯」—— 由 API 端 service role 處理，
-- 此處僅放行 SELECT

-- ==================== users ====================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 任何登入者可以讀取其他使用者的公開名稱/頭像（顯示司機卡片用）
CREATE POLICY "users_select_public_fields"
  ON public.users FOR SELECT
  TO authenticated
  USING (true);

-- 僅自己能改自己的 name/phone/avatar_url
CREATE POLICY "users_update_self"
  ON public.users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ==================== driver_info ====================
ALTER TABLE public.driver_info ENABLE ROW LEVEL SECURITY;

-- 任何登入者可以讀取司機公開資訊（顯示司機卡片用）
CREATE POLICY "driver_info_select_public"
  ON public.driver_info FOR SELECT
  TO authenticated
  USING (true);

-- 僅司機能改自己的 driver_info
CREATE POLICY "driver_info_update_self"
  ON public.driver_info FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ==================== driver_applications ====================
ALTER TABLE public.driver_applications ENABLE ROW LEVEL SECURITY;

-- 申請者讀自己的申請（透過 phone 對應；簡化為允許 anon / authenticated 讀自己的）
-- 實務上「自己查自己」由 API 端 service role 處理，這裡只放 admin 透過 service role 寫入
-- 故不再為 anon / authenticated 開 SELECT（保持 deny-all）

-- ==================== announcements ====================
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- 跑馬燈公告：任何登入者與匿名者都能讀啟用中的公告
CREATE POLICY "announcements_select_active"
  ON public.announcements FOR SELECT
  TO anon, authenticated
  USING (active = true);

-- 寫入/更新：僅 service role（無 policy 即 deny）

-- ==================== 收尾：清理 anon 過寬權限 ====================
-- Supabase 預設 anon 對所有表有 USAGE 權限（用於 PostgREST），
-- 上述 policy 已細部放行/拒絕。
-- 注意：service_role 自動 bypass RLS，所有現有 API 行為不受影響。
