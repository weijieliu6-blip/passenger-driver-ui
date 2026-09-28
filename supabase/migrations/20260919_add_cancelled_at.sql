-- 添加订单取消功能相关字段
-- 执行日期：2026-09-19
-- 说明：使用 IF NOT EXISTS 确保可以重复执行

-- 1. 添加 cancelled_at 字段（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'cancelled_at'
    ) THEN
        ALTER TABLE orders ADD COLUMN cancelled_at TIMESTAMPTZ;
        COMMENT ON COLUMN orders.cancelled_at IS '订单取消时间';
        RAISE NOTICE '✅ 已添加 cancelled_at 字段';
    ELSE
        RAISE NOTICE '⚠️  cancelled_at 字段已存在，跳过';
    END IF;
END $$;

-- 2. 添加 expired 状态到枚举（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'expired' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'order_status')
    ) THEN
        ALTER TYPE order_status ADD VALUE 'expired';
        RAISE NOTICE '✅ 已添加 expired 状态';
    ELSE
        RAISE NOTICE '⚠️  expired 状态已存在，跳过';
    END IF;
END $$;

-- 3. 创建索引（如果不存在）
CREATE INDEX IF NOT EXISTS idx_orders_cancelled_at 
ON orders(cancelled_at) 
WHERE cancelled_at IS NOT NULL;

-- 4. 添加约束（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_cancelled_at'
    ) THEN
        ALTER TABLE orders 
        ADD CONSTRAINT check_cancelled_at 
        CHECK (
            (status = 'cancelled' AND cancelled_at IS NOT NULL) 
            OR 
            (status != 'cancelled')
        );
        RAISE NOTICE '✅ 已添加 check_cancelled_at 约束';
    ELSE
        RAISE NOTICE '⚠️  check_cancelled_at 约束已存在，跳过';
    END IF;
END $$;

-- 完成提示
DO $$
BEGIN
    RAISE NOTICE '🎉 订单取消功能数据库迁移完成！';
END $$;
