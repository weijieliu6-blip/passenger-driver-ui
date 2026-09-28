-- =============================================================================
-- Unify driver schema: drivers_profile is DEPRECATED.
-- Canonical source of truth is public.driver_info (id = public.users.id FK).
-- This migration is idempotent and safe to re-run.
-- =============================================================================

-- 1. Ensure the canonical membership_tier enum exists with the driver_info values.
DO $$ BEGIN
    CREATE TYPE membership_tier AS ENUM (
      'gold',
      'platinum',
      'normal',
      'none'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Make sure driver_info.membership_tier uses the enum (idempotent).
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'driver_info'
          AND column_name  = 'membership_tier'
          AND udt_name    <> 'membership_tier'
    ) THEN
        ALTER TABLE public.driver_info
            ALTER COLUMN membership_tier TYPE membership_tier USING membership_tier::membership_tier;
    END IF;
END $$;

-- 3. Best-effort data migration from drivers_profile -> driver_info.
--    drivers_profile membership_tier was ('free','gold','diamond'); normalize to enum.
INSERT INTO public.driver_info (
    id, vehicle_plate, vehicle_model, driving_years,
    total_orders, total_rating_sum, total_rating_count, rating,
    membership_tier, membership_expires_at,
    created_at, updated_at
)
SELECT
    dp.user_id,
    COALESCE(dp.vehicle_plate, '待補充'),
    dp.vehicle_type,
    0,
    0, 0, 0, COALESCE(dp.rating, 5.0),
    CASE
        WHEN dp.membership_tier = 'gold'    THEN 'gold'::membership_tier
        WHEN dp.membership_tier = 'diamond' THEN 'platinum'::membership_tier
        ELSE 'none'::membership_tier
    END,
    NULL,
    dp.created_at,
    NOW()
FROM public.drivers_profile dp
WHERE dp.user_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- 4. Drop the obsolete table (CASCADE because of any FK references).
DROP TABLE IF EXISTS public.drivers_profile CASCADE;

-- 5. Mark the canonical schema.
COMMENT ON TABLE public.driver_info IS
    'CANONICAL driver schema; do NOT create drivers_profile. id REFERENCES public.users(id).';