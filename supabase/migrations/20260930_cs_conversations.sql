-- 2026-09-30 — AI 客服 + 人工轉接
-- 簡化版：cs_conversations + cs_messages
-- AI 自動回覆，必要時升級為人工

CREATE TABLE IF NOT EXISTS public.cs_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'ai' CHECK (status IN ('ai', 'human_needed', 'human_active', 'closed')),
  subject TEXT,
  assigned_admin_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cs_conv_status ON public.cs_conversations (status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_cs_conv_user ON public.cs_conversations (user_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS public.cs_messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.cs_conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('user', 'ai', 'admin', 'system')),
  content TEXT NOT NULL,
  ai_confidence NUMERIC(3,2),  -- AI 自評信心 0-1（若 < 0.4 自動升級人工）
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cs_msg_conv_created
  ON public.cs_messages (conversation_id, created_at);

COMMENT ON TABLE public.cs_conversations IS '客服會話（AI / 人工）';
COMMENT ON TABLE public.cs_messages IS '客服會話訊息';

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.cs_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cs_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cs_conv_read_own_or_admin" ON public.cs_conversations;
CREATE POLICY "cs_conv_read_own_or_admin" ON public.cs_conversations
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "cs_conv_insert_own" ON public.cs_conversations;
CREATE POLICY "cs_conv_insert_own" ON public.cs_conversations
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "cs_conv_update_admin" ON public.cs_conversations;
CREATE POLICY "cs_conv_update_admin" ON public.cs_conversations
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "cs_msg_read_own_or_admin" ON public.cs_messages;
CREATE POLICY "cs_msg_read_own_or_admin" ON public.cs_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.cs_conversations c
      WHERE c.id = cs_messages.conversation_id
        AND (c.user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
    )
  );

DROP POLICY IF EXISTS "cs_msg_insert_own_or_admin" ON public.cs_messages;
CREATE POLICY "cs_msg_insert_own_or_admin" ON public.cs_messages
  FOR INSERT WITH CHECK (
    (sender_id = auth.uid() AND sender_role = 'user') OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- 開 Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.cs_messages;