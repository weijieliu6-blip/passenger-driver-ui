-- 检查订单取消功能的数据库状态
-- 用于验证迁移是否完成

-- 1. 检查 cancelled_at 字段是否存在
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'orders' 
AND column_name = 'cancelled_at';

-- 2. 检查 order_status 枚举的所有值
SELECT 
    unnest(enum_range(NULL::order_status)) AS status_values;

-- 3. 检查 check_cancelled_at 约束是否存在
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname = 'check_cancelled_at';

-- 4. 检查 idx_orders_cancelled_at 索引是否存在
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'orders'
AND indexname = 'idx_orders_cancelled_at';

-- 5. 查看 orders 表的所有字段
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'orders'
ORDER BY ordinal_position;
