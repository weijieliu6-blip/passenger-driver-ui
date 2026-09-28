-- 港中專車 - 訂單表
-- 創建時間: 2026-09-18
-- 說明: 存儲乘客預約訂單和司機搶單信息

-- 創建訂單狀態枚舉類型
CREATE TYPE order_status AS ENUM (
  'pending',      -- 待搶單
  'grabbed',      -- 已搶單
  'cancelled',    -- 已取消
  'completed',    -- 已完成
  'expired'       -- 已過期
);

-- 創建車輛類型枚舉
CREATE TYPE vehicle_type AS ENUM (
  '4_seat',       -- 4座車（僅深圳⇄汕尾）
  '7_seat',       -- 7座車
  '8_seat'        -- 8座車
);

-- 創建行程方向枚舉
CREATE TYPE trip_direction AS ENUM (
  'to_mainland',  -- 回內地
  'to_hk'         -- 回香港
);

-- 創建孩童類型枚舉
CREATE TYPE child_type AS ENUM (
  'infant',       -- 嬰兒（0-3歲以下）
  'over_3'        -- 3歲以上
);

-- 創建訂單表
CREATE TABLE orders (
  -- 主鍵和時間戳
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- 訂單基本信息
  order_number VARCHAR(20) UNIQUE NOT NULL, -- 訂單號，例如：ORD20260918001
  status order_status NOT NULL DEFAULT 'pending',
  
  -- 搶單 Token（用於生成搶單鏈接）
  grab_token VARCHAR(64) UNIQUE NOT NULL, -- 隨機生成的安全 token
  grab_token_expires_at TIMESTAMPTZ NOT NULL, -- token 過期時間（訂單創建後24小時）
  
  -- 行程信息
  direction trip_direction NOT NULL,
  pickup_location VARCHAR(50) NOT NULL,    -- 出發地（主城市/區域）
  pickup_area VARCHAR(100),                -- 出發地（具體區域，如果是香港）
  dropoff_location VARCHAR(50) NOT NULL,   -- 目的地（主城市/區域）
  dropoff_area VARCHAR(100),               -- 目的地（具體區域，如果是香港）
  departure_time TIMESTAMPTZ NOT NULL,     -- 出發時間
  
  -- 乘客信息
  passengers INTEGER NOT NULL CHECK (passengers >= 1 AND passengers <= 8),
  luggage INTEGER NOT NULL DEFAULT 0 CHECK (luggage >= 0),
  vehicle_type vehicle_type NOT NULL,
  is_charter BOOLEAN NOT NULL DEFAULT false, -- 是否包車
  
  -- 孩童信息（新增）
  has_child BOOLEAN NOT NULL DEFAULT false,
  child_type child_type,
  
  -- 乘客聯繫方式
  passenger_name VARCHAR(50),
  passenger_phone VARCHAR(20) NOT NULL,
  passenger_notes TEXT,                    -- 乘客備註
  
  -- 司機信息（搶單後填寫）
  driver_name VARCHAR(50),
  driver_phone VARCHAR(20),
  driver_plate VARCHAR(20),                -- 車牌號
  driver_notes TEXT,                       -- 司機備註
  grabbed_at TIMESTAMPTZ,                  -- 搶單時間
  
  -- 訂單完成信息
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT
);

-- 創建索引以提升查詢性能
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_grab_token ON orders(grab_token) WHERE status = 'pending';
CREATE INDEX idx_orders_departure_time ON orders(departure_time);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_order_number ON orders(order_number);

-- 創建更新時間觸發器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 創建訂單號生成函數
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  count INTEGER;
BEGIN
  -- 生成格式：ORD + YYYYMMDD + 3位數字流水號
  -- 例如：ORD20260918001
  
  -- 獲取今天已有的訂單數量
  SELECT COUNT(*) INTO count
  FROM orders
  WHERE DATE(created_at AT TIME ZONE 'Asia/Hong_Kong') = CURRENT_DATE;
  
  -- 生成訂單號
  new_number := 'ORD' || 
                TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || 
                LPAD((count + 1)::TEXT, 3, '0');
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- 創建 grab_token 生成函數
CREATE OR REPLACE FUNCTION generate_grab_token()
RETURNS TEXT AS $$
DECLARE
  token TEXT;
  exists BOOLEAN;
BEGIN
  -- 生成一個安全的隨機 token
  LOOP
    -- 使用 gen_random_uuid() 生成隨機字符串
    token := encode(gen_random_bytes(32), 'hex');
    
    -- 檢查是否已存在
    SELECT EXISTS(SELECT 1 FROM orders WHERE grab_token = token) INTO exists;
    
    -- 如果不存在，返回這個 token
    IF NOT exists THEN
      RETURN token;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 添加註釋
COMMENT ON TABLE orders IS '港中專車訂單表 - 存儲乘客預約和司機搶單信息';
COMMENT ON COLUMN orders.grab_token IS '搶單鏈接的唯一token，用於生成 /grab/[token] 鏈接';
COMMENT ON COLUMN orders.grab_token_expires_at IS 'token過期時間，防止舊訂單被惡意搶單';
COMMENT ON COLUMN orders.has_child IS '是否有孩童同行';
COMMENT ON COLUMN orders.child_type IS '孩童年齡類型：infant(嬰兒) 或 over_3(3歲以上)';
