-- 為訂單表添加評分相關字段
-- 以及更新完成訂單時記錄完成時間

-- 1. 添加評分字段（如果不存在）
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS rating INTEGER CHECK (rating >= 1 AND rating <= 5),
ADD COLUMN IF NOT EXISTS rated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- 2. 創建索引（可選，加速查詢）
CREATE INDEX IF NOT EXISTS idx_orders_rating ON orders(rating) WHERE rating IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_completed_at ON orders(completed_at) WHERE completed_at IS NOT NULL;

-- 3. 驗證
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'orders' 
AND column_name IN ('rating', 'rated_at', 'completed_at');

-- 完成！
