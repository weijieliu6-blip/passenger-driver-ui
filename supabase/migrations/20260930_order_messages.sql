-- 2026-09-30 — 即時文字訊息（乘客 ↔ 司機）
-- 使用 Supabase Realtime 訂閱 order_messages，零成本

CREATE TABLE IF NOT EXISTS public.order_messages (
  id BIGSERIAL PRIMARY KEY,
  order_number TEXT NOT NULL REFERENCES public.orders(order_number) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('passenger', 'driver', 'admin', 'system')),
  content TEXT NOT NULL,
  read_at TIMESTAMPTZ,                -- 對方已讀時間
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 高效查詢：依訂單 + 時間排序
CREATE INDEX IF NOT EXISTS idx_order_messages_order_created
  ON public.order_messages (order_number, created_at DESC);

-- 全文搜尋（可選）：便於客服後台搜尋歷史
CREATE INDEX IF NOT EXISTS idx_order_messages_content_search
  ON public.order_messages USING gin (to_tsvector('simple', content));

COMMENT ON TABLE public.order_messages IS '訂單即時文字訊息（乘客 ↔ 司機 + 系統訊息）';

-- ============================================================
-- RLS：訂單的乘客/司機/管理員可讀寫
-- ============================================================
ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_messages_read_authorized" ON public.order_messages;
CREATE POLICY "order_messages_read_authorized" ON public.order_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.order_number = order_messages.order_number
      AND (o.passenger_id = auth.uid() OR o.driver_id = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')))
  );

DROP POLICY IF EXISTS "order_messages_insert_authorized" ON public.order_messages;
CREATE POLICY "order_messages_insert_authorized" ON public.order_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.orders o WHERE o.order_number = order_messages.order_number
      AND (o.passenger_id = auth.uid() OR o.driver_id = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'system'))))
  );

DROP POLICY IF EXISTS "order_messages_update_own_read" ON public.order_messages;
CREATE POLICY "order_messages_update_own_read" ON public.order_messages
  FOR UPDATE USING (
    -- 只能把自己收到的訊息標為已讀（不是自己送的）
    sender_id != auth.uid() AND
    EXISTS (SELECT 1 FROM public.orders o WHERE o.order_number = order_messages.order_number
      AND (o.passenger_id = auth.uid() OR o.driver_id = auth.uid()))
  );

-- 讓 Realtime 廣播 INSERT 事件
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_messages;