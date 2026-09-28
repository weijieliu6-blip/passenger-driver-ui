-- 司機招募申請表（獨立於 drivers，方便後台審核管理）
-- 創建時間: 2026-09-28

CREATE TABLE IF NOT EXISTS public.driver_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  plate text NOT NULL,
  car_type text NOT NULL CHECK (car_type IN ('sedan_5', 'alphard_7', 'business_9')),
  driving_years integer NOT NULL CHECK (driving_years >= 3 AND driving_years <= 50),
  city text,
  has_cross_border_permit boolean NOT NULL DEFAULT false,
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'approved', 'rejected')),
  reviewed_at timestamptz,
  reviewer_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_applications_status ON public.driver_applications (status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_driver_applications_created ON public.driver_applications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_applications_phone ON public.driver_applications (phone);

COMMENT ON TABLE public.driver_applications IS '司機招募申請 - 待後台審核';
COMMENT ON COLUMN public.driver_applications.status IS 'pending=待審 / reviewing=跟進中 / approved=已批准 / rejected=已拒絕';

DROP TRIGGER IF EXISTS trg_driver_applications_updated_at ON public.driver_applications;
CREATE TRIGGER trg_driver_applications_updated_at
  BEFORE UPDATE ON public.driver_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS：暫時公開 INSERT（允許匿名申請），SELECT 限定 service_role
ALTER TABLE public.driver_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "driver_applications_insert_anon" ON public.driver_applications;
CREATE POLICY "driver_applications_insert_anon" ON public.driver_applications FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "driver_applications_admin_all" ON public.driver_applications;
CREATE POLICY "driver_applications_admin_all" ON public.driver_applications FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );
