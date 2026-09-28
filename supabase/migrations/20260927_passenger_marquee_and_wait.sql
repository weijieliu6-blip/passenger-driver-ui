-- 港中專車 - 乘客端公告表 + 訂單等待時間欄位
-- 創建時間: 2026-09-27
-- 說明:
--   1) 新增 announcements 表：管理員可手動建立推播，前端主要用隨機 + 節假日文案
--   2) 訂單新增 dispatch_deadline_at / first_driver_offered_at / accepted_at
--      讓等待接單頁有明確的 24h 倒數與狀態顯示

-- =========================================================
-- 1) 公告表
-- =========================================================
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  kind text NOT NULL DEFAULT 'info' CHECK (kind IN ('info', 'holiday', 'warning', 'hot')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at   timestamptz,
  active    boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 索引：加速「目前生效中」的查詢
CREATE INDEX IF NOT EXISTS idx_announcements_active_window
  ON public.announcements (active, starts_at DESC, ends_at)
  WHERE active = true;

COMMENT ON TABLE public.announcements IS '乘客端跑馬燈公告（管理員可手動建立；前端也會根據節假日自動產生文案）';
COMMENT ON COLUMN public.announcements.kind IS '公告類型：info/holiday/warning/hot';
COMMENT ON COLUMN public.announcements.starts_at IS '公告生效起始時間';
COMMENT ON COLUMN public.announcements.ends_at IS '公告結束時間（NULL = 無限期）';

-- 預設 RLS：管理員可寫，匿名可讀（公開資訊）
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "announcements_select_all" ON public.announcements;
CREATE POLICY "announcements_select_all"
  ON public.announcements
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "announcements_admin_all" ON public.announcements;
CREATE POLICY "announcements_admin_all"
  ON public.announcements
  FOR ALL
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
-- 2) 訂單等待時間欄位
-- =========================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS dispatch_deadline_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_driver_offered_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

COMMENT ON COLUMN public.orders.dispatch_deadline_at IS '司機接單 deadline（建立訂單時 = now + 24h）；超過即視為逾時';
COMMENT ON COLUMN public.orders.first_driver_offered_at IS '第一位司機接單/報價的時間（用於「已被接單」統計）';
COMMENT ON COLUMN public.orders.accepted_at IS '司機接單時間（等同 grabbed_at，但語義更明確）';

-- 回填既有 pending 訂單：把 deadline 設為 max(grab_token_expires_at, created_at + 24h)
UPDATE public.orders
SET dispatch_deadline_at = GREATEST(
  COALESCE(dispatch_deadline_at, '1970-01-01'::timestamptz),
  COALESCE(grab_token_expires_at, '1970-01-01'::timestamptz),
  created_at + INTERVAL '24 hours'
)
WHERE status = 'pending' AND dispatch_deadline_at IS NULL;