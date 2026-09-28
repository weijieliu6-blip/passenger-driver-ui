-- 司機狀態欄位
-- 為 driver_info 新增 status 字段以支援司機手動切換在線/忙碌/休息

ALTER TABLE public.driver_info
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'offline'
CHECK (status IN ('on_trip', 'available', 'offline'));

COMMENT ON COLUMN public.driver_info.status IS 'Manual driver status: on_trip (currently executing), available (accepting orders), offline (resting, will not receive pushes)';

-- 為現有司機設定為 offline（預設安全）
UPDATE public.driver_info
SET status = 'offline'
WHERE status IS NULL;

-- 索引：方便快速查詢可接單司機
CREATE INDEX IF NOT EXISTS idx_driver_info_status ON public.driver_info(status);
