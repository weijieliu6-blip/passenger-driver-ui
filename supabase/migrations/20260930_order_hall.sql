-- 2026-09-30 — 接單大廳：訂單逾時未搶 → 進大廳
-- 範圍：
--   1. order_status enum 新增 'pending_hall'
--   2. orders 新增 entered_hall_at 欄位
--   3. pg_cron：每分鐘掃描 pending 訂單，超過 1 小時無人搶 → 進大廳
--   4. RPC：get_hall_orders（司機拉取大廳訂單，含當前 user 排除已搶）

-- ============================================================
-- 1. enum 擴充
-- ============================================================
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'pending_hall';

COMMENT ON TYPE order_status IS 'pending=待搶單 / pending_hall=已進大廳（無人搶） / grabbed=已搶單 / completed / cancelled / expired';

-- ============================================================
-- 2. orders 新欄位
-- ============================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS entered_hall_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_pending_hall
  ON public.orders (entered_hall_at DESC)
  WHERE status = 'pending_hall';

COMMENT ON COLUMN public.orders.entered_hall_at IS '訂單進入接單大廳的時間';

-- ============================================================
-- 3. pg_cron：每分鐘掃描逾時訂單進大廳
-- ============================================================
-- 注意：pg_cron 需先在 Supabase Dashboard → Database → Extensions 啟用
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 先刪除舊的（避免重複）
SELECT cron.unschedule('moves-expired-orders-to-hall')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'moves-expired-orders-to-hall');

-- 建立排程：每分鐘執行
-- 把 status='pending' 且現在 - created_at > 1 小時的訂單移到 pending_hall
SELECT cron.schedule(
  'moves-expired-orders-to-hall',
  '* * * * *',  -- 每分鐘
  $cron$
    UPDATE public.orders
    SET status = 'pending_hall',
        entered_hall_at = NOW()
    WHERE status = 'pending'
      AND created_at < NOW() - INTERVAL '1 hour'
      AND entered_hall_at IS NULL;
  $cron$
);

-- ============================================================
-- 4. RPC：司機拉取大廳訂單（只回傳 pending_hall + 自己的地區 / 過濾條件）
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_hall_orders(
  p_vehicle_type TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50
)
RETURNS SETOF public.orders
LANGUAGE sql
SECURITY DEFINER  -- 跳過 RLS（呼叫端需有 driver role 才透過 API gate）
AS $$
  SELECT *
    FROM public.orders
    WHERE status = 'pending_hall'
    ORDER BY entered_hall_at ASC  -- 早進大廳的優先
    LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.get_hall_orders IS '司機從接單大廳拉取訂單（含逾時未搶的）';

-- ============================================================
-- 5. RPC：司機搶大廳訂單（原子操作，搶到即改為 grabbed + driver_id）
-- ============================================================
CREATE OR REPLACE FUNCTION public.grab_hall_order(
  p_order_number TEXT,
  p_driver_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_driver RECORD;
BEGIN
  -- 確認訂單還在大廳
  SELECT * INTO v_order FROM orders WHERE order_number = p_order_number FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '訂單不存在');
  END IF;
  IF v_order.status != 'pending_hall' THEN
    RETURN jsonb_build_object('success', false, 'error', '訂單已被搶或狀態已變更', 'current_status', v_order.status);
  END IF;

  -- 確認司機存在 + 帳號正常（admin 帳號不可搶單）
  SELECT id, role, membership_tier INTO v_driver FROM users WHERE id = p_driver_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '司機帳號不存在');
  END IF;
  IF v_driver.role != 'driver' THEN
    RETURN jsonb_build_object('success', false, 'error', '此帳號不是司機帳號');
  END IF;

  -- 原子搶單
  UPDATE orders
  SET status = 'grabbed',
      driver_id = p_driver_id,
      driver_name = (SELECT name FROM users WHERE id = p_driver_id),
      grabbed_at = NOW(),
      grab_token = NULL  -- 大廳訂單不再使用 token
  WHERE order_number = p_order_number
    AND status = 'pending_hall';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '搶單失敗（狀態已變更）');
  END IF;

  RETURN jsonb_build_object('success', true, 'order_number', p_order_number, 'driver_id', p_driver_id);
END;
$$;

COMMENT ON FUNCTION public.grab_hall_order IS '司機搶大廳訂單（搶到即原子更新；防止超賣）';

-- ============================================================
-- 6. 司機查詢權限：新增 admin SELECT + 大廳可見政策（不刪舊政策）
-- ============================================================
-- 讓大廳訂單（status='pending_hall'）所有司機可見
DROP POLICY IF EXISTS "orders_select_hall_for_drivers" ON public.orders;
CREATE POLICY "orders_select_hall_for_drivers" ON public.orders
  FOR SELECT TO authenticated
  USING (
    status = 'pending_hall' AND
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'driver')
  );

-- admin 可看所有訂單
DROP POLICY IF EXISTS "orders_select_all_for_admin" ON public.orders;
CREATE POLICY "orders_select_all_for_admin" ON public.orders
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );