-- Proof desk: remember measurements, and keep the fields the app already writes.
--
-- Applied live as version 20261019024229 (name proof_desk_watch).
-- The version prefix matches schema_migrations so this file is not run again.
--
-- lat/lon, OSM tags and benchmark were used by the client and the
-- local-benchmark function but were never added in a committed migration.
-- watch_log stores the diff between measurements so the Today desk can say
-- what changed. Safe to run more than once.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lat            DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lon            DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS osm_tag_key    TEXT,
  ADD COLUMN IF NOT EXISTS osm_tag_value  TEXT,
  ADD COLUMN IF NOT EXISTS benchmark      JSONB,
  ADD COLUMN IF NOT EXISTS benchmarked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS watch_log      JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS last_watch_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS watch_seen_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_leads_watch
  ON public.leads(user_id, last_watch_at DESC)
  WHERE last_watch_at IS NOT NULL;

-- Public proof pages are self-contained in the URL (the hash is the document).
-- This table is optional storage so a short link can be reissued later.
-- Anonymous visitors can read a row only if they know its id, which is the
-- verification code. They cannot list the table.
CREATE TABLE IF NOT EXISTS public.proofs (
  id           TEXT PRIMARY KEY,
  user_id      UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  business     TEXT,
  payload      JSONB NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.proofs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner inserts proofs" ON public.proofs;
CREATE POLICY "owner inserts proofs" ON public.proofs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "owner reads own proofs" ON public.proofs;
CREATE POLICY "owner reads own proofs" ON public.proofs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Anon does not get SELECT on the table. A filter-less select would dump every
-- proof. Visitors fetch one document through get_proof(id), which returns a
-- single row. The shareable link itself does not need this table — the URL
-- fragment already contains the signed document.
REVOKE ALL ON public.proofs FROM anon;
GRANT SELECT, INSERT ON public.proofs TO authenticated;

CREATE OR REPLACE FUNCTION public.get_proof(p_id TEXT)
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT payload FROM public.proofs WHERE id = p_id LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_proof(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_proof(TEXT) TO anon, authenticated;
