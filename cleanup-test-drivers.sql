-- ============================================
-- 一鍵清理 9000000X 測試司機的所有殘留
-- 在 Supabase Dashboard → SQL Editor 執行
-- ============================================

-- 1. 查看現狀
SELECT 'BEFORE: public.users' as stage, id, phone, name, role
FROM public.users
WHERE phone IN ('90000001','90000002','90000003','90000004');

SELECT 'BEFORE: driver_info' as stage, d.id, d.membership_tier, d.vehicle_plate, u.phone
FROM public.driver_info d
LEFT JOIN public.users u ON u.id = d.id
WHERE u.phone IN ('90000001','90000002','90000003','90000004')
   OR d.id IN (
     SELECT id FROM public.users
     WHERE phone IN ('90000001','90000002','90000003','90000004')
   );

SELECT 'BEFORE: auth.users' as stage, id, phone, email
FROM auth.users
WHERE phone IN ('+85290000001','85290000001','90000001',
                '+85290000002','85290000002','90000002',
                '+85290000003','85290000003','90000003',
                '+85290000004','85290000004','90000004');

-- 2. 刪 driver_info（如果還有 FK 殘留）
DELETE FROM public.driver_info
WHERE id IN (
  SELECT id FROM public.users
  WHERE phone IN ('90000001','90000002','90000003','90000004')
);

-- 3. 刪 public.users
DELETE FROM public.users
WHERE phone IN ('90000001','90000002','90000003','90000004');

-- 4. 刪 auth.users（要先刪 public.users 因為 FK）
DELETE FROM auth.users
WHERE phone IN ('+85290000001','85290000001','90000001',
                '+85290000002','85290000002','90000002',
                '+85290000003','85290000003','90000003',
                '+85290000004','85290000004','90000004');

-- 5. 驗證清理結果（應該都是 0 行）
SELECT 'AFTER: public.users' as stage, count(*) as remaining
FROM public.users
WHERE phone IN ('90000001','90000002','90000003','90000004');

SELECT 'AFTER: auth.users' as stage, count(*) as remaining
FROM auth.users
WHERE phone IN ('+85290000001','85290000002','+85290000003','+85290000004');
