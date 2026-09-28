-- Supabase Auth 配置 SQL
-- 用於配置身份驗證相關的功能

-- 1. 創建自定義函數：檢查用戶是否為管理員
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 創建自定義函數：檢查用戶是否為司機
CREATE OR REPLACE FUNCTION is_driver()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'driver'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 創建自定義函數：獲取當前用戶角色
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- 4. 創建測試用戶（開發環境使用）
-- 注意：在生產環境中，應該通過 Supabase Auth UI 註冊真實用戶

-- 插入測試乘客用戶（需要先在 Supabase Auth 中創建對應的 auth.users）
-- 示例 SQL（需要替換 UUID）:
/*
-- 假設 auth.users 中已有用戶 ID
INSERT INTO public.users (id, role, phone, name)
VALUES 
  ('passenger-uuid-1', 'passenger', '12345678', '測試乘客1'),
  ('passenger-uuid-2', 'passenger', '12345679', '測試乘客2')
ON CONFLICT (id) DO NOTHING;
*/

-- 插入測試司機用戶
/*
INSERT INTO public.users (id, role, phone, name)
VALUES 
  ('driver-uuid-1', 'driver', '87654321', '測試司機1'),
  ('driver-uuid-2', 'driver', '87654322', '測試司機2'),
  ('driver-uuid-3', 'driver', '87654323', '測試司機3')
ON CONFLICT (id) DO NOTHING;

-- 插入測試司機資料
INSERT INTO public.drivers_profile (user_id, membership_tier, vehicle_plate, vehicle_type, max_passengers, max_luggage, rating)
VALUES 
  ('driver-uuid-1', 'diamond', 'ABC123', '7座商務車', 7, 4, 4.9),
  ('driver-uuid-2', 'gold', 'DEF456', '7座商務車', 7, 3, 4.7),
  ('driver-uuid-3', 'free', 'GHI789', '5座轎車', 5, 2, 4.8)
ON CONFLICT (user_id) DO NOTHING;
*/

-- 5. 創建函數：自動為新訂單分配默認評分
CREATE OR REPLACE FUNCTION set_default_passenger_rating()
RETURNS TRIGGER AS $$
BEGIN
  -- 如果沒有指定乘客評分，使用默認值 5.0
  IF NEW.passenger_rating IS NULL THEN
    NEW.passenger_rating := 5.0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_default_passenger_rating
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION set_default_passenger_rating();

-- 6. 創建視圖：方便查詢訂單詳情（包含乘客和司機信息）
CREATE OR REPLACE VIEW order_details AS
SELECT 
  o.*,
  p.name as passenger_name,
  p.phone as passenger_phone,
  d.name as driver_name,
  d.phone as driver_phone,
  dp.vehicle_plate,
  dp.vehicle_type,
  dp.membership_tier as driver_membership_tier
FROM orders o
LEFT JOIN users p ON o.passenger_id = p.id
LEFT JOIN users d ON o.driver_id = d.id
LEFT JOIN drivers_profile dp ON o.driver_id = dp.user_id;

-- 7. 創建函數：防止司機接已接的單
CREATE OR REPLACE FUNCTION check_order_available()
RETURNS TRIGGER AS $$
BEGIN
  -- 檢查訂單狀態
  IF OLD.status != 'pending' THEN
    RAISE EXCEPTION '訂單已被接單或已完成';
  END IF;
  
  -- 檢查是否已有司機
  IF OLD.driver_id IS NOT NULL AND OLD.driver_id != NEW.driver_id THEN
    RAISE EXCEPTION '訂單已被其他司機接單';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_order_available
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  WHEN (NEW.status = 'accepted' AND OLD.status = 'pending')
  EXECUTE FUNCTION check_order_available();

-- 完成！Auth 配置已完成
