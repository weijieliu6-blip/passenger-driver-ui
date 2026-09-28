-- 司機出車時間排程（Schedule）
-- recurring：每週固定星期＋時段
-- oneoff   ：指定日期＋時段

CREATE TABLE IF NOT EXISTS public.driver_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.driver_info(id) ON DELETE CASCADE,
  schedule_type text NOT NULL CHECK (schedule_type IN ('recurring','oneoff')),
  weekday smallint CHECK (weekday BETWEEN 0 AND 6),  -- recurring 用：0=週日, 6=週六
  start_time time,
  end_time time,
  schedule_date date,                               -- oneoff 用
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_schedules_driver_id
  ON public.driver_schedules(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_schedules_date
  ON public.driver_schedules(schedule_date);
CREATE INDEX IF NOT EXISTS idx_driver_schedules_recurring
  ON public.driver_schedules(driver_id, weekday)
  WHERE schedule_type = 'recurring';

COMMENT ON TABLE public.driver_schedules IS
  'Driver availability schedule. recurring=weekly slots, oneoff=specific date slot.';
COMMENT ON COLUMN public.driver_schedules.weekday IS
  '0=Sun, 1=Mon, ..., 6=Sat (only for recurring schedules)';
COMMENT ON COLUMN public.driver_schedules.schedule_type IS
  'recurring=weekly pattern, oneoff=specific date';
