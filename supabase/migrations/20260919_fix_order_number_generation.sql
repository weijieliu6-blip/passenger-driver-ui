-- 修复订单号生成函数，使用行锁避免并发重复

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  max_number TEXT;
  next_seq INTEGER;
  date_prefix TEXT;
BEGIN
  -- 生成日期前缀：ORD + YYYYMMDD
  date_prefix := 'ORD' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
  
  -- 使用行锁获取今天最大的订单号
  SELECT order_number INTO max_number
  FROM orders
  WHERE order_number LIKE date_prefix || '%'
  ORDER BY order_number DESC
  LIMIT 1
  FOR UPDATE;
  
  -- 计算下一个序号
  IF max_number IS NULL THEN
    next_seq := 1;
  ELSE
    -- 提取最后3位数字并加1
    next_seq := (SUBSTRING(max_number FROM 12 FOR 3)::INTEGER) + 1;
  END IF;
  
  -- 生成新订单号
  new_number := date_prefix || LPAD(next_seq::TEXT, 3, '0');
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;
