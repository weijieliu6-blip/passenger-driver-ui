-- 添加服务类型字段
-- 创建时间: 2026-09-19
-- 说明: 为订单表添加服务类型，区分跨境专车和内地专车

-- 创建服务类型枚举
CREATE TYPE service_type AS ENUM (
  'cross_border',  -- 跨境专车（香港⇄内地）
  'mainland_local' -- 内地专车（深圳⇄汕尾）
);

-- 添加 service_type 字段
ALTER TABLE orders 
ADD COLUMN service_type service_type;

-- 更新现有数据（假设旧数据都是跨境）
UPDATE orders 
SET service_type = 'cross_border' 
WHERE service_type IS NULL;

-- 设置为必填字段
ALTER TABLE orders 
ALTER COLUMN service_type SET NOT NULL;

-- 更新 trip_direction 枚举类型
-- 先删除旧枚举值的约束
ALTER TABLE orders 
ALTER COLUMN direction TYPE VARCHAR(20);

-- 删除旧枚举类型
DROP TYPE trip_direction;

-- 创建新的方向枚举类型
CREATE TYPE trip_direction AS ENUM (
  'hk_to_mainland',  -- 跨境：香港 → 内地
  'mainland_to_hk',  -- 跨境：内地 → 香港
  'sz_to_sw',        -- 内地：深圳 → 汕尾
  'sw_to_sz'         -- 内地：汕尾 → 深圳
);

-- 更新现有数据
UPDATE orders 
SET direction = CASE 
  WHEN direction = 'to_mainland' THEN 'hk_to_mainland'
  WHEN direction = 'to_hk' THEN 'mainland_to_hk'
  ELSE direction
END;

-- 恢复枚举类型约束
ALTER TABLE orders 
ALTER COLUMN direction TYPE trip_direction 
USING direction::trip_direction;

-- 添加注释
COMMENT ON COLUMN orders.service_type IS '服务类型：cross_border(跨境专车) 或 mainland_local(内地专车)';
COMMENT ON TYPE trip_direction IS '行程方向：跨境(香港⇄内地) 或 内地(深圳⇄汕尾)';
