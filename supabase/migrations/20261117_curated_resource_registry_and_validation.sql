-- ==============================================================================
-- LABVERSE – MVIT CURATED RESOURCE REGISTRY & VALIDATION METADATA
-- Additive, non-destructive migration for experiments resource fields.
-- ==============================================================================

ALTER TABLE public.experiments
  ADD COLUMN IF NOT EXISTS youtube_alt_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS youtube_search_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS simulation_url TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS simulation_provider TEXT DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS simulation_type TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS built_in_simulator_id TEXT,
  ADD COLUMN IF NOT EXISTS simulation_note TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS resource_status TEXT DEFAULT 'verified',
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;

-- Synchronize existing simulator_type / bench_twin_url into canonical resource fields if empty
UPDATE public.experiments
SET
  built_in_simulator_id = CASE
    WHEN simulator_type IN ('pn_junction', 'pendulum', 'calipers', 'ph_meter') THEN simulator_type
    ELSE NULL
  END,
  simulation_url = COALESCE(NULLIF(simulation_url, ''), bench_twin_url, ''),
  simulation_type = CASE
    WHEN simulator_type IN ('pn_junction', 'pendulum', 'calipers', 'ph_meter')
      AND COALESCE(NULLIF(bench_twin_url, ''), '') <> '' THEN 'hybrid'
    WHEN simulator_type IN ('pn_junction', 'pendulum', 'calipers', 'ph_meter') THEN 'built_in'
    WHEN COALESCE(NULLIF(bench_twin_url, ''), '') <> '' THEN 'external'
    ELSE 'none'
  END
WHERE built_in_simulator_id IS NULL
  AND COALESCE(simulation_url, '') = '';
