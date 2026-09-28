-- 紧急修复：添加 service_type 字段
-- 如果字段已存在会报错，请忽略

-- 创建服务类型枚举（如果不存在）
DO $$ BEGIN
    CREATE TYPE service_type AS ENUM (
      'cross_border',
      'mainland_local'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 添加 service_type 字段（如果不存在）
DO $$ BEGIN
    ALTER TABLE orders 
    ADD COLUMN service_type service_type DEFAULT 'cross_border';
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- 更新现有数据
UPDATE orders 
SET service_type = 'cross_border' 
WHERE service_type IS NULL;

-- 验证
SELECT column_name, data_type, udt_name 
FROM information_schema.columns 
WHERE table_name = 'orders' 
  AND column_name = 'service_type';
