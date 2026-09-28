-- 司機會員等級字段
-- 用於新訂單推送分級延遲

-- 1. 創建會員等級枚舉（如果不存在）
DO $$ BEGIN
    CREATE TYPE membership_tier AS ENUM (
      'gold',      -- 黃金：即時推送
      'platinum',  -- 白金：延遲 60 秒
      'normal',    -- 普通：延遲 120 秒
      'none'       -- 非會員：只走釘釘推送
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. 給 driver_info 表加 membership_tier 字段（司機資料表）
DO $$ BEGIN
    ALTER TABLE driver_info
    ADD COLUMN membership_tier membership_tier DEFAULT 'gold';
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- 3. 給 driver_info 表加會員到期時間
DO $$ BEGIN
    ALTER TABLE driver_info
    ADD COLUMN membership_expires_at TIMESTAMPTZ;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- 4. 給 orders 表加搶單相關字段（分級推送時間戳）
DO $$ BEGIN
    ALTER TABLE orders
    ADD COLUMN gold_released_at TIMESTAMPTZ;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE orders
    ADD COLUMN platinum_released_at TIMESTAMPTZ;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE orders
    ADD COLUMN normal_released_at TIMESTAMPTZ;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- 5. 給 orders 表加過期時間
DO $$ BEGIN
    ALTER TABLE orders
    ADD COLUMN expires_at TIMESTAMPTZ;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- 6. 給 orders 表加釘釘推送狀態
DO $$ BEGIN
    ALTER TABLE orders
    ADD COLUMN dingtalk_pushed BOOLEAN DEFAULT FALSE;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- 7. 給現有司機設置默認等級（測試用，全設為 gold）
UPDATE driver_info
SET membership_tier = 'gold'
WHERE membership_tier IS NULL;

-- 8. 給現有待搶訂單設置過期時間
UPDATE orders
SET expires_at = created_at + INTERVAL '30 minutes'
WHERE expires_at IS NULL AND status = 'pending';

-- 9. 驗證
DO $$
BEGIN
    RAISE NOTICE '✅ 司機會員分級字段已添加';
    RAISE NOTICE '   - driver_info 表：membership_tier, membership_expires_at';
    RAISE NOTICE '   - orders 表：gold_released_at, platinum_released_at, normal_released_at, expires_at, dingtalk_pushed';
END $$;
