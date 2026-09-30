-- 2026-09-30（修補）— 訂單號產生 race condition
-- 創建時間: 2026-09-30
-- 原因：generate_order_number() 用「今天最大的訂單號 FOR UPDATE」鎖，
--       但若當天尚無訂單，FOR UPDATE 不鎖任何 row；
--       多個 transaction 同時拿到 next_seq=1 → INSERT 撞 unique constraint。
-- 修法：
--   1. 在函數開頭用 pg_advisory_xact_lock(hash)，確保同一時間只有一個
--      transaction 在跑 generate_order_number；lock 在 transaction 結束自動釋放。
--   2. 即使如此，POSTGRES 也可能在極端情況重複（理論上不會），
--      故保留 FOR UPDATE 作為第二層保險。

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  max_number TEXT;
  next_seq INTEGER;
  date_prefix TEXT;
  lock_key BIGINT;
BEGIN
  date_prefix := 'ORD' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD');

  -- 計算當天的 advisory lock key（用 date_prefix hash 對應到固定 BIGINT）
  -- 用 hashtext() 把日期字串 hash 到 int，再 cast 成 bigint 確保 pg_advisory_xact_lock 參數型別對
  lock_key := ('x' || substr(md5(date_prefix), 1, 16))::bit(64)::bigint;
  PERFORM pg_advisory_xact_lock(lock_key);

  -- 行級鎖（次要防護；advisory lock 已能確保單調遞增）
  SELECT order_number INTO max_number
  FROM orders
  WHERE order_number LIKE date_prefix || '%'
  ORDER BY order_number DESC
  LIMIT 1
  FOR UPDATE;

  IF max_number IS NULL THEN
    next_seq := 1;
  ELSE
    next_seq := (SUBSTRING(max_number FROM 12 FOR 3)::INTEGER) + 1;
  END IF;

  new_number := date_prefix || LPAD(next_seq::TEXT, 3, '0');

  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- 同時改 grab_token 函式為 advisory lock
CREATE OR REPLACE FUNCTION generate_grab_token()
RETURNS TEXT AS $$
DECLARE
  token TEXT;
BEGIN
  -- 32 bytes hex = 64 字元；gen_random_bytes 需要 pgcrypto
  token := encode(gen_random_bytes(32), 'hex');
  RETURN token;
END;
$$ LANGUAGE plpgsql;