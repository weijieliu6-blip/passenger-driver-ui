-- 2026-09-30（補丁）— grab_token 改為 nullable + UNIQUE 改為 partial unique
-- 創建時間: 2026-09-30
-- 原因：搶單成功後要把 grab_token 清空（防止重用），
--       但欄位是 NOT NULL，導致 UPDATE 永遠失敗。
--       改為：
--         1. NOT NULL 移除
--         2. UNIQUE constraint 改為 partial index
--            （只對非 NULL、非 sentinel 的值強制唯一；
--            sentinel '__CONSUMED__' 表示已消費）
--       注意：應用層將 grab_token 設為 '__CONSUMED__' 是臨時方案；
--       若日後 DB 套用 migration 直接設 NULL，partial index 也會允許多筆 NULL。

ALTER TABLE public.orders ALTER COLUMN grab_token DROP NOT NULL;

-- 移除舊的全表 UNIQUE 約束
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_grab_token_key;

-- 建立 partial unique index：只對「尚未消費」的 token 強制唯一
-- '__CONSUMED__' 視為已消費，不參與唯一性
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_grab_token_active
  ON public.orders (grab_token)
  WHERE grab_token IS NOT NULL AND grab_token != '__CONSUMED__';

-- 一般查詢索引（非唯一，給所有非 NULL 用）
DROP INDEX IF EXISTS idx_orders_grab_token;
CREATE INDEX IF NOT EXISTS idx_orders_grab_token_all
  ON public.orders (grab_token)
  WHERE grab_token IS NOT NULL;